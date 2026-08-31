// ============================================================
// Palta Order Routes
// ============================================================
// Place an order, list orders, view an order, cancel, rate,
// receipt, and reorder.
//
// IMPORTANT:
// Real payment providers are NOT required at this stage.
// Card payments use MOCK/PENDING mode until a real provider
// is connected.
// ============================================================

const express = require("express");
const { z } = require("zod");

const { prisma } = require("../prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

// ============================================================
// VALIDATION
// ============================================================

const lineSchema = z.object({
  menuItemId: z.string().min(1),

  quantity: z
    .number()
    .int()
    .min(1)
    .max(20),

  options: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        price: z.number(),
      })
    )
    .optional()
    .default([]),

  notes: z
    .string()
    .max(200)
    .optional()
    .default(""),
});

const placeSchema = z.object({
  restaurantId: z.string().min(1),

  lines: z
    .array(lineSchema)
    .min(1),

  tip: z
    .number()
    .min(0)
    .optional()
    .default(0),

  deliveryAddress: z
    .string()
    .max(300)
    .optional()
    .default(""),

  deliveryType: z
    .enum(["DELIVERY", "PICKUP"])
    .optional()
    .default("DELIVERY"),

  paymentMethod: z
    .enum(["card", "cash"])
    .optional()
    .default("card"),

  currency: z
    .string()
    .length(3)
    .optional()
    .default("AED"),
});

const ratingSchema = z.object({
  foodRating: z
    .number()
    .int()
    .min(1)
    .max(5),

  driverRating: z
    .number()
    .int()
    .min(1)
    .max(5)
    .optional(),

  comment: z
    .string()
    .max(500)
    .optional(),
});

// ============================================================
// POST /orders
// Place an order
// ============================================================

router.post("/", async (req, res) => {
  const parsed = placeSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid order",
      detail: parsed.error.issues,
    });
  }

  const {
    restaurantId,
    lines,
    tip,
    deliveryAddress,
    deliveryType,
    paymentMethod,
  } = parsed.data;

  try {
    // --------------------------------------------------------
    // Find restaurant
    // --------------------------------------------------------

    const restaurant =
      await prisma.restaurant.findUnique({
        where: {
          id: restaurantId,
        },
      });

    if (!restaurant) {
      return res.status(404).json({
        error: "Restaurant not found",
      });
    }

    // --------------------------------------------------------
    // Validate restaurant availability
    // --------------------------------------------------------

    if (
      restaurant.isOpen === false
    ) {
      return res.status(409).json({
        error:
          "This restaurant is currently closed",
      });
    }

    // --------------------------------------------------------
    // Load requested menu items
    // --------------------------------------------------------

    const menuItemIds = [
      ...new Set(
        lines.map(
          (line) => line.menuItemId
        )
      ),
    ];

    const menuItems =
      await prisma.menuItem.findMany({
        where: {
          id: {
            in: menuItemIds,
          },

          restaurantId,
        },
      });

    const menuById = new Map(
      menuItems.map((item) => [
        item.id,
        item,
      ])
    );

    // --------------------------------------------------------
    // Validate every item and calculate prices SERVER-SIDE
    // --------------------------------------------------------

    const verifiedItems = [];

    let subtotal = 0;

    for (const line of lines) {
      const item =
        menuById.get(
          line.menuItemId
        );

      if (!item) {
        return res.status(400).json({
          error:
            `Menu item not found: ${line.menuItemId}`,
        });
      }

      if (
        item.isAvailable === false
      ) {
        return res.status(409).json({
          error:
            `${item.name} is currently unavailable`,
        });
      }

      const unitPrice =
        Number(item.price);

      const lineTotal =
        unitPrice *
        line.quantity;

      subtotal += lineTotal;

      verifiedItems.push({
        menuItemId: item.id,
        name: item.name,
        price: unitPrice,
        quantity: line.quantity,
        options:
          line.options || [],
        notes:
          line.notes || "",
      });
    }

    // --------------------------------------------------------
    // Delivery fee
    // --------------------------------------------------------

    const deliveryFee =
      deliveryType === "PICKUP"
        ? 0
        : Number(
            restaurant.deliveryFee || 0
          );

    // --------------------------------------------------------
    // Total
    // --------------------------------------------------------

    const total =
      subtotal +
      deliveryFee +
      Number(tip || 0);

    // --------------------------------------------------------
    // Currency / country
    // --------------------------------------------------------

    const country =
      restaurant.country || "AE";

    const currency =
      restaurant.currency ||
      "AED";

    // --------------------------------------------------------
    // Create order
    //
    // NOTE:
    // We intentionally use the existing Prisma Order model
    // through a small data payload. No external order service
    // is required.
    // --------------------------------------------------------

    const orderData = {
      customerId:
        req.user.userId,

      restaurantId,

      items: verifiedItems,

      subtotal,

      deliveryFee,

      tip: Number(tip || 0),

      total,

      currency,

      country,

      deliveryType,

      deliveryAddress,

      status: "PENDING",
    };

    let order;

    try {
      order =
        await prisma.order.create({
          data: orderData,
        });
    } catch (createError) {
      // ------------------------------------------------------
      // If the deployed Prisma schema does not yet contain
      // country, retry without country.
      // ------------------------------------------------------

      if (
        String(
          createError.message || ""
        ).includes("country")
      ) {
        delete orderData.country;

        order =
          await prisma.order.create({
            data: orderData,
          });
      } else {
        throw createError;
      }
    }

    // --------------------------------------------------------
    // MOCK PAYMENT
    // --------------------------------------------------------
    //
    // No real Stripe/M-Pesa/provider connection yet.
    // --------------------------------------------------------

    const payment =
      paymentMethod === "cash"
        ? {
            provider: "cash",
            status: "pending",
            clientSecret: null,
            paymentIntentId: null,
            mock: true,
          }
        : {
            provider: "mock",
            status: "pending",
            clientSecret: null,
            paymentIntentId:
              `mock_${order.id}`,
            mock: true,
          };

    // --------------------------------------------------------
    // Notify restaurant owner
    // --------------------------------------------------------

    if (restaurant.ownerId) {
      try {
        const {
          emitToUser,
        } = require("../realtime");

        if (
          typeof emitToUser ===
          "function"
        ) {
          emitToUser(
            restaurant.ownerId,
            "order:new",
            {
              orderId: order.id,
            }
          );
        }
      } catch (notifyError) {
        console.warn(
          "[POST /orders] realtime notification skipped:",
          notifyError.message
        );
      }
    }

    return res.status(201).json({
      order,
      payment,
    });
  } catch (err) {
    console.error(
      "[POST /orders]",
      err
    );

    return res.status(400).json({
      error:
        err.message ||
        "Unable to create order",
    });
  }
});

// ============================================================
// GET /orders
// Customer's orders
// ============================================================

router.get("/", async (req, res) => {
  try {
    const orders =
      await prisma.order.findMany({
        where: {
          customerId:
            req.user.userId,
        },

        orderBy: {
          createdAt: "desc",
        },

        include: {
          restaurant: {
            select: {
              name: true,
              cuisineType: true,
            },
          },
        },
      });

    return res.json({
      orders,
    });
  } catch (err) {
    console.error(
      "[GET /orders]",
      err
    );

    return res.status(500).json({
      error:
        "Unable to load orders",
    });
  }
});

// ============================================================
// GET /orders/:id
// ============================================================

router.get("/:id", async (req, res) => {
  try {
    const order =
      await prisma.order.findUnique({
        where: {
          id: req.params.id,
        },

        include: {
          restaurant: {
            select: {
              name: true,
              address: true,
              lat: true,
              lng: true,
            },
          },

          driver: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

    if (
      !order ||
      order.customerId !==
        req.user.userId
    ) {
      return res.status(404).json({
        error: "Order not found",
      });
    }

    let driverProfile = null;

    if (order.driverId) {
      driverProfile =
        await prisma.driverProfile.findUnique(
          {
            where: {
              userId:
                order.driverId,
            },

            select: {
              vehicleType: true,
              vehicleMake: true,
              vehicleModel: true,
              vehicleColor: true,
              licensePlate: true,
              currentLat: true,
              currentLng: true,
            },
          }
        );
    }

    return res.json({
      order: {
        ...order,
        driverProfile,
      },
    });
  } catch (err) {
    console.error(
      "[GET /orders/:id]",
      err
    );

    return res.status(500).json({
      error:
        "Unable to load order",
    });
  }
});

// ============================================================
// POST /orders/:id/cancel
// ============================================================

router.post(
  "/:id/cancel",
  async (req, res) => {
    try {
      const order =
        await prisma.order.findUnique({
          where: {
            id: req.params.id,
          },
        });

      if (
        !order ||
        order.customerId !==
          req.user.userId
      ) {
        return res.status(404).json({
          error: "Order not found",
        });
      }

      const cancellableStatuses = [
        "PENDING",
        "CONFIRMED",
        "PLACED",
      ];

      if (
        !cancellableStatuses.includes(
          String(order.status)
        )
      ) {
        return res.status(409).json({
          error:
            "This order can no longer be cancelled",
        });
      }

      const updated =
        await prisma.order.update({
          where: {
            id: order.id,
          },

          data: {
            status: "CANCELLED",
          },
        });

      return res.json({
        order: updated,
      });
    } catch (err) {
      console.error(
        "[POST /orders/:id/cancel]",
        err
      );

      return res.status(500).json({
        error:
          "Unable to cancel order",
      });
    }
  }
);

// ============================================================
// POST /orders/:id/rate
// ============================================================

router.post(
  "/:id/rate",
  async (req, res) => {
    const parsed =
      ratingSchema.safeParse(
        req.body
      );

    if (!parsed.success) {
      return res.status(400).json({
        error:
          "foodRating (1-5) required",
      });
    }

    try {
      const order =
        await prisma.order.findUnique({
          where: {
            id: req.params.id,
          },

          include: {
            rating: true,
          },
        });

      if (
        !order ||
        order.customerId !==
          req.user.userId
      ) {
        return res.status(404).json({
          error: "Order not found",
        });
      }

      if (
        order.status !==
        "DELIVERED"
      ) {
        return res.status(409).json({
          error:
            "You can only rate a delivered order",
        });
      }

      if (order.rating) {
        return res.status(409).json({
          error:
            "You've already rated this order",
        });
      }

      const rating =
        await prisma.rating.create({
          data: {
            orderId: order.id,

            customerId:
              req.user.userId,

            restaurantId:
              order.restaurantId,

            driverId:
              order.driverId,

            foodRating:
              parsed.data
                .foodRating,

            driverRating:
              parsed.data
                .driverRating ??
              null,

            comment:
              parsed.data
                .comment ||
              null,
          },
        });

      const agg =
        await prisma.rating.aggregate(
          {
            where: {
              restaurantId:
                order.restaurantId,
            },

            _avg: {
              foodRating: true,
            },
          }
        );

      if (
        agg._avg.foodRating !=
        null
      ) {
        await prisma.restaurant.update(
          {
            where: {
              id: order.restaurantId,
            },

            data: {
              rating:
                Number(
                  agg._avg
                    .foodRating
                .toFixed(1)
                ),
            },
          }
        );
      }

      return res.status(201).json({
        rating,
      });
    } catch (err) {
      console.error(
        "[POST /orders/:id/rate]",
        err
      );

      return res.status(500).json({
        error:
          "Unable to rate order",
      });
    }
  }
);

// ============================================================
// GET /orders/:id/receipt
// ============================================================

router.get(
  "/:id/receipt",
  async (req, res) => {
    try {
      const order =
        await prisma.order.findUnique({
          where: {
            id: req.params.id,
          },

          include: {
            restaurant: {
              select: {
                name: true,
                address: true,
              },
            },
          },
        });

      if (
        !order ||
        order.customerId !==
          req.user.userId
      ) {
        return res.status(404).json({
          error: "Order not found",
        });
      }

      return res.json({
        receipt: {
          orderId: order.id,

          shortId:
            order.id
              .slice(-6)
              .toUpperCase(),

          currency:
            order.currency,

          restaurant:
            order.restaurant?.name,

          restaurantAddress:
            order.restaurant
              ?.address,

          placedAt:
            order.createdAt,

          deliveredAt:
            order.deliveredAt,

          deliveryType:
            order.deliveryType,

          deliveryAddress:
            order.deliveryAddress,

          items:
            order.items,

          subtotal:
            order.subtotal,

          deliveryFee:
            order.deliveryFee,

          tip: order.tip,

          total:
            order.total,

          status:
            order.status,
        },
      });
    } catch (err) {
      console.error(
        "[GET /orders/:id/receipt]",
        err
      );

      return res.status(500).json({
        error:
          "Unable to create receipt",
      });
    }
  }
);

// ============================================================
// GET /orders/:id/reorder
// ============================================================

router.get(
  "/:id/reorder",
  async (req, res) => {
    try {
      const order =
        await prisma.order.findUnique({
          where: {
            id: req.params.id,
          },
        });

      if (
        !order ||
        order.customerId !==
          req.user.userId
      ) {
        return res.status(404).json({
          error: "Order not found",
        });
      }

      const restaurant =
        await prisma.restaurant.findUnique(
          {
            where: {
              id: order.restaurantId,
            },
          }
        );

      if (
        !restaurant ||
        restaurant.isOpen ===
          false
      ) {
        return res.status(409).json({
          error:
            "This restaurant isn't available right now",
        });
      }

      const menuItems =
        await prisma.menuItem.findMany(
          {
            where: {
              restaurantId:
                order.restaurantId,
            },
          }
        );

      const byId = new Map(
        menuItems.map(
          (item) => [
            item.id,
            item,
          ]
        )
      );

      const lines = [];
      const unavailable = [];

      for (
        const it of
        order.items || []
      ) {
        const item =
          byId.get(
            it.menuItemId
          );

        if (
          item &&
          item.isAvailable
        ) {
          lines.push({
            menuItemId:
              item.id,

            name:
              item.name,

            price:
              item.price,

            quantity:
              it.quantity,

            options:
              it.options ||
              [],

            notes:
              it.notes ||
              "",
          });
        } else {
          unavailable.push(
            it.name ||
              it.menuItemId
          );
        }
      }

      return res.json({
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          deliveryFee:
            restaurant.deliveryFee,
        },

        lines,

        unavailable,
      });
    } catch (err) {
      console.error(
        "[GET /orders/:id/reorder]",
        err
      );

      return res.status(500).json({
        error:
          "Unable to prepare reorder",
      });
    }
  }
);

// ============================================================
// EXPORT
// ============================================================

module.exports = router;
