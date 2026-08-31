import { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet, TouchableOpacity, Text } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { api, getToken, clearToken } from "./src/lib/api";
import { theme } from "./src/lib/theme";
import { addressStore } from "./src/lib/addressStore";
import LoginScreen from "./src/screens/LoginScreen";
import RestaurantsScreen from "./src/screens/RestaurantsScreen";
import RestaurantMenuScreen from "./src/screens/RestaurantMenuScreen";
import StoreScreen from "./src/screens/StoreScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import ItemDetailScreen from "./src/screens/ItemDetailScreen";
import OrderScreen from "./src/screens/OrderScreen";
import CheckoutScreen from "./src/screens/CheckoutScreen";
import OrderPlacedScreen from "./src/screens/OrderPlacedScreen";
import OrdersScreen from "./src/screens/OrdersScreen";
import OrderTrackingScreen from "./src/screens/OrderTrackingScreen";
import RateOrderScreen from "./src/screens/RateOrderScreen";
import ReceiptScreen from "./src/screens/ReceiptScreen";
import AddressScreen from "./src/screens/AddressScreen";
import RoleSelectScreen from "./src/screens/RoleSelectScreen";
import HomeScreen from "./src/screens/HomeScreen";
import ParcelCreateScreen from "./src/screens/ParcelCreateScreen";
import ParcelTrackingScreen from "./src/screens/ParcelTrackingScreen";

const Stack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: theme.bg, card: theme.bg, text: theme.text, border: theme.line, primary: theme.accent },
};

export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    (async () => {
      await addressStore.hydrate();
      const token = await getToken();
      if (token) {
        try {
          const { data } = await api.get("/auth/me");
          setUser(data.user);
        } catch {
          await clearToken();
        }
      }
      setBooting(false);
    })();
  }, []);

  if (booting) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {!user ? (
        <LoginScreen onAuthed={setUser} />
      ) : (
        <NavigationContainer theme={navTheme}>
          <Stack.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: theme.bg },
              headerTintColor: theme.text,
              headerTitleStyle: { fontWeight: "700" },
              contentStyle: { backgroundColor: theme.bg },
            }}
          >
            <Stack.Screen name="Restaurants" options={{ headerShown: false }}>
              {(props) => <RestaurantsScreen {...props} user={user} />}
            </Stack.Screen>
            <Stack.Screen
              name="Menu"
              component={RestaurantMenuScreen}
              options={{ title: "" }}
            />
            <Stack.Screen
              name="ItemDetail"
              component={ItemDetailScreen}
              options={{ title: "" }}
            />
            <Stack.Screen
              name="Order"
              component={OrderScreen}
              options={({ route }) => ({ title: route.params.restaurant.name })}
            />
            <Stack.Screen name="Store" component={StoreScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Profile" options={{ headerShown: false }}>
              {(props) => <ProfileScreen {...props} onSignOut={() => setUser(null)} />}
            </Stack.Screen>
            <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="RoleSelect" component={RoleSelectScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ParcelCreate" component={ParcelCreateScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ParcelTracking" component={ParcelTrackingScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Address" component={AddressScreen} options={{ title: "Delivery address" }} />
            <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: "Checkout" }} />
            <Stack.Screen name="OrderPlaced" component={OrderPlacedScreen} options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="Orders" component={OrdersScreen} options={{ title: "My orders" }} />
            <Stack.Screen name="OrderDetail" component={OrderTrackingScreen} options={{ title: "Track order" }} />
            <Stack.Screen name="RateOrder" component={RateOrderScreen} options={{ title: "Rate order" }} />
            <Stack.Screen name="Receipt" component={ReceiptScreen} options={{ title: "Receipt" }} />
          </Stack.Navigator>
        </NavigationContainer>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center" },
});
