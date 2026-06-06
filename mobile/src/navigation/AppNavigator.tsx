/**
 * App Navigator — Main navigation structure for TheHoneyBee Mobile.
 * Auth Stack → Main Tabs (role-dependent)
 * Admin:   Chats | Students | Reports | Community | Profile
 * Teacher: Chats | Batches  | Reports | Community | Profile
 * Student: Chats | Batches  | Community | Profile
 */
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { COLORS, FONT_SIZE } from '../theme/theme';

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen';

// Chat screens
import ChatListScreen from '../screens/chat/ChatListScreen';
import PrivateChatScreen from '../screens/chat/PrivateChatScreen';

// Batch screens
import BatchListScreen from '../screens/batch/BatchListScreen';
import BatchChatScreen from '../screens/batch/BatchChatScreen';
import BatchDetailScreen from '../screens/batch/BatchDetailScreen';

// Community
import CommunityHubScreen from '../screens/community/CommunityHubScreen';
import AnnouncementsScreen from '../screens/community/AnnouncementsScreen';

// Profile
import ProfileScreen from '../screens/profile/ProfileScreen';

// File screens
import FileViewerScreen from '../screens/files/FileViewerScreen';
import FileUploadScreen from '../screens/files/FileUploadScreen';

// Admin screens
import ManageStudentsScreen from '../screens/admin/ManageStudentsScreen';

// Reports screens
import ReportsHubScreen from '../screens/reports/ReportsHubScreen';
import DailyReportScreen from '../screens/reports/DailyReportScreen';
import WeeklyReportScreen from '../screens/reports/WeeklyReportScreen';

// Global components
import PaymentReminderModal from '../components/PaymentReminderModal';

const AuthStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const ChatStackNav = createNativeStackNavigator();
const BatchStackNav = createNativeStackNavigator();
const CommunityStackNav = createNativeStackNavigator();
const ProfileStackNav = createNativeStackNavigator();
const StudentsStackNav = createNativeStackNavigator();
const ReportsStackNav = createNativeStackNavigator();

const stackScreenOptions = {
  headerStyle: { backgroundColor: COLORS.surface },
  headerTintColor: COLORS.primary,
  headerTitleStyle: { fontWeight: '600' as const, color: COLORS.text },
  headerShadowVisible: false,
};

// --- Chat Stack ---
function ChatStackNavigator() {
  return (
    <ChatStackNav.Navigator screenOptions={stackScreenOptions}>
      <ChatStackNav.Screen name="ChatList" component={ChatListScreen} options={{ title: 'Chats' }} />
      <ChatStackNav.Screen name="PrivateChat" component={PrivateChatScreen} options={{ title: 'Chat' }} />
      <ChatStackNav.Screen name="FileViewer" component={FileViewerScreen} options={{ title: 'Files' }} />
      <ChatStackNav.Screen name="FileUpload" component={FileUploadScreen} options={{ title: 'Upload File' }} />
    </ChatStackNav.Navigator>
  );
}

// --- Batch Stack ---
function BatchStackNavigator() {
  return (
    <BatchStackNav.Navigator screenOptions={stackScreenOptions}>
      <BatchStackNav.Screen name="BatchList" component={BatchListScreen} options={{ title: 'Batches' }} />
      <BatchStackNav.Screen name="BatchChat" component={BatchChatScreen} options={{ title: 'Batch Chat' }} />
      <BatchStackNav.Screen name="BatchDetail" component={BatchDetailScreen} options={{ title: 'Batch Info' }} />
      <BatchStackNav.Screen name="FileViewer" component={FileViewerScreen} options={{ title: 'Files' }} />
      <BatchStackNav.Screen name="FileUpload" component={FileUploadScreen} options={{ title: 'Upload File' }} />
    </BatchStackNav.Navigator>
  );
}

// --- Community Stack ---
function CommunityStackNavigator() {
  const { userRole, userStatus } = useAuth();
  const role = (userRole || '').toLowerCase();
  const isAdmin = role === 'admin';
  const isTeacher = role === 'teacher';

  if (isAdmin) {
    return (
      <CommunityStackNav.Navigator screenOptions={stackScreenOptions}>
        <CommunityStackNav.Screen name="CommunityHub" component={CommunityHubScreen} options={{ title: 'Community' }} />
        <CommunityStackNav.Screen name="ChannelChat" component={AnnouncementsScreen} options={{ title: 'Channel' }} />
      </CommunityStackNav.Navigator>
    );
  }

  // Determine specific channel for non-admins
  let channel = 'allStudents';
  let title = 'All Students';

  if (isTeacher) {
    channel = 'teachers';
    title = 'Teachers';
  } else if (userStatus && userStatus.toLowerCase() === 'active') {
    channel = 'activeStudents';
    title = 'Active Students';
  }

  return (
    <CommunityStackNav.Navigator screenOptions={stackScreenOptions}>
      <CommunityStackNav.Screen 
        name="ChannelChat" 
        component={AnnouncementsScreen} 
        options={{ title }}
        initialParams={{ channel, channelTitle: title }}
      />
    </CommunityStackNav.Navigator>
  );
}

// --- Profile Stack ---
function ProfileStackNavigator() {
  return (
    <ProfileStackNav.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: COLORS.textInverse,
        headerTitleStyle: { fontWeight: '600' },
        headerShadowVisible: false,
      }}
    >
      <ProfileStackNav.Screen
        name="ProfileHome"
        component={ProfileScreen}
        options={{ title: 'Profile', headerShown: false }}
      />
    </ProfileStackNav.Navigator>
  );
}

// --- Students Stack (Admin only) ---
function StudentsStackNavigator() {
  return (
    <StudentsStackNav.Navigator screenOptions={stackScreenOptions}>
      <StudentsStackNav.Screen
        name="ManageStudents"
        component={ManageStudentsScreen}
        options={{ title: 'Students' }}
      />
    </StudentsStackNav.Navigator>
  );
}

// --- Reports Stack (Admin + Teacher) ---
function ReportsStackNavigator() {
  return (
    <ReportsStackNav.Navigator screenOptions={stackScreenOptions}>
      <ReportsStackNav.Screen name="ReportsHub" component={ReportsHubScreen} options={{ title: 'Reports' }} />
      <ReportsStackNav.Screen name="DailyReport" component={DailyReportScreen} options={{ title: 'Daily Report' }} />
      <ReportsStackNav.Screen name="WeeklyReport" component={WeeklyReportScreen} options={{ title: 'Weekly Report' }} />
    </ReportsStackNav.Navigator>
  );
}

// --- Tab Icon Resolver ---
function getTabIcon(routeName: string, focused: boolean): keyof typeof Ionicons.glyphMap {
  switch (routeName) {
    case 'ChatsTab': return focused ? 'chatbubbles' : 'chatbubbles-outline';
    case 'StudentsTab': return focused ? 'school' : 'school-outline';
    case 'BatchesTab': return focused ? 'people' : 'people-outline';
    case 'ReportsTab': return focused ? 'document-text' : 'document-text-outline';
    case 'CommunityTab': return focused ? 'megaphone' : 'megaphone-outline';
    case 'ProfileTab': return focused ? 'person' : 'person-outline';
    default: return 'ellipse';
  }
}

// --- Main Bottom Tabs ---
function MainTabs() {
  const { userRole } = useAuth();
  const role = (userRole || 'student').toLowerCase();
  const insets = useSafeAreaInsets();

  return (
    <>
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.tabActive,
        tabBarInactiveTintColor: COLORS.tabInactive,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopWidth: 0.5,
          borderTopColor: COLORS.border,
          paddingTop: 4,
          paddingBottom: Math.max(insets.bottom, 6),
          height: 58 + Math.max(insets.bottom - 6, 0),
        },
        tabBarLabelStyle: { fontSize: FONT_SIZE.xs, fontWeight: '500' },
        tabBarIcon: ({ focused, color }) => (
          <Ionicons name={getTabIcon(route.name, focused)} size={22} color={color} />
        ),
      })}
    >
      <Tab.Screen name="BatchesTab" component={BatchStackNavigator} options={{ tabBarLabel: 'Batches' }} />
      <Tab.Screen name="ChatsTab" component={ChatStackNavigator} options={{ tabBarLabel: 'Chats' }} />

      {/* Admin specific tab */}
      {role === 'admin' && (
        <Tab.Screen name="StudentsTab" component={StudentsStackNavigator} options={{ tabBarLabel: 'Students' }} />
      )}

      {/* Reports tab for Admin and Teacher */}
      {(role === 'admin' || role === 'teacher') && (
        <Tab.Screen name="ReportsTab" component={ReportsStackNavigator} options={{ tabBarLabel: 'Reports' }} />
      )}

      <Tab.Screen name="CommunityTab" component={CommunityStackNavigator} options={{ tabBarLabel: 'Community' }} />
      <Tab.Screen name="ProfileTab" component={ProfileStackNavigator} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>

    {/* Payment Reminder Modal — shows for unpaid students on app open */}
    <PaymentReminderModal />
    </>
  );
}

// --- Auth Stack ---
function AuthStackNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

// --- Root Navigator ---
export default function AppNavigator() {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {currentUser ? <MainTabs /> : <AuthStackNavigator />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
});
