import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter, type Href } from 'expo-router';
import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SmoothPressable } from '@/components/SmoothPressable';
import { deleteProfilePhoto, pickProfilePhoto } from '@/attachments/files';
import { useSettings } from '@/settings/SettingsContext';
import type { ThemeMode } from '@/settings/storage';
import { useTheme } from '@/theme';
import { showMessage } from '@/utils/confirm';

const MENU_ITEMS: {
  label: 'Preferences' | 'Notifications' | 'Data & Privacy' | 'Help & Support' | 'About Planova';
  description: string;
  icon: 'options-outline' | 'notifications-outline' | 'shield-checkmark-outline' | 'help-circle-outline' | 'information-circle-outline';
}[] = [
  { label: 'Preferences', description: 'Appearance and app defaults', icon: 'options-outline' },
  { label: 'Notifications', description: 'Reminders and habit nudges', icon: 'notifications-outline' },
  { label: 'Data & Privacy', description: 'Manage your data and privacy', icon: 'shield-checkmark-outline' },
  { label: 'Help & Support', description: 'Get help using Planova', icon: 'help-circle-outline' },
  { label: 'About Planova', description: 'Version and app information', icon: 'information-circle-outline' },
];

const NOTIFICATION_ITEMS = ['Priority reminders', 'Schedule reminders', 'Habit nudges'] as const;

const APPEARANCE_OPTIONS: { id: ThemeMode; label: string; icon: 'sunny-outline' | 'moon-outline' }[] = [
  { id: 'light', label: 'Light', icon: 'sunny-outline' },
  { id: 'dark', label: 'Dark', icon: 'moon-outline' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { settings, update } = useSettings();
  const [editVisible, setEditVisible] = useState(false);
  const [preferencesExpanded, setPreferencesExpanded] = useState(false);
  const [notificationsExpanded, setNotificationsExpanded] = useState(false);
  const [nameDraft, setNameDraft] = useState(settings.nickname);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const changeProfilePhoto = async () => {
    if (photoBusy) return;
    setPhotoBusy(true);
    try {
      const photoUri = await pickProfilePhoto();
      if (!photoUri) return;
      const previousPhoto = settings.profilePhotoUri;
      await update('profilePhotoUri', photoUri);
      try {
        await deleteProfilePhoto(previousPhoto);
      } catch (error) {
        showMessage('Photo saved', error instanceof Error ? `The previous photo could not be removed: ${error.message}` : 'The previous photo could not be removed.');
      }
    } catch (error) {
      showMessage('Unable to update profile photo', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const removeProfilePhoto = async () => {
    if (photoBusy || !settings.profilePhotoUri) return;
    setPhotoBusy(true);
    try {
      const previousPhoto = settings.profilePhotoUri;
      await update('profilePhotoUri', null);
      setEditVisible(false);
      try {
        await deleteProfilePhoto(previousPhoto);
      } catch (error) {
        showMessage('Photo removed', error instanceof Error ? `The photo file could not be removed: ${error.message}` : 'The photo file could not be removed.');
      }
    } catch (error) {
      showMessage('Unable to remove profile photo', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const openEditProfile = () => {
    setNameDraft(settings.nickname);
    setEditVisible(true);
  };

  const saveProfile = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await update('nickname', nameDraft.trim());
      setEditVisible(false);
    } catch (error) {
      showMessage('Unable to update profile', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleMenuItem = (item: typeof MENU_ITEMS[number]['label']) => {
    switch (item) {
      case 'Preferences':
        setPreferencesExpanded((expanded) => !expanded);
        return;
      case 'Notifications':
        setNotificationsExpanded((expanded) => !expanded);
        return;
      case 'Data & Privacy':
        router.push('/settings' as Href);
        return;
      case 'Help & Support':
        router.push({ pathname: '/chat', params: { prompt: 'I need help using Planova. Please guide me through the app features.' } });
        return;
      case 'About Planova':
        showMessage(Constants.expoConfig?.name ?? 'Planova', `Version ${Constants.expoConfig?.version ?? '1.0.0'}\nYour daily planner, saved on this device.`);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="header" style={[styles.pageTitle, { color: theme.text }]}>Profile</Text>

        <View style={[styles.profileCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.avatarWrap}>
            <SmoothPressable accessibilityRole="button" accessibilityLabel={settings.profilePhotoUri ? 'Change profile photo' : 'Add profile photo'} disabled={photoBusy} onPress={() => void changeProfilePhoto()} style={[styles.avatar, { backgroundColor: theme.buttonSecondary, borderColor: theme.border }]}>
              {settings.profilePhotoUri ? (
                <Image source={{ uri: settings.profilePhotoUri }} style={styles.avatarPhoto} />
              ) : settings.nickname.trim() ? (
                <Text style={[styles.avatarInitial, { color: theme.tint }]}>{settings.nickname.trim().charAt(0).toUpperCase()}</Text>
              ) : (
                <Ionicons name="person-outline" size={31} color={theme.tint} />
              )}
            </SmoothPressable>
            <SmoothPressable accessibilityRole="button" accessibilityLabel={settings.profilePhotoUri ? 'Change profile photo' : 'Add profile photo'} disabled={photoBusy} onPress={() => void changeProfilePhoto()} style={[styles.avatarEdit, { backgroundColor: theme.tint, borderColor: theme.card }]}>
              <Ionicons name={settings.profilePhotoUri ? 'camera' : 'add'} size={14} color={theme.background} />
            </SmoothPressable>
          </View>
          <View style={styles.profileDetails}>
            <Text style={[styles.profileEyebrow, { color: theme.tint }]}>YOUR PROFILE</Text>
            <Text style={[styles.profileName, { color: theme.text }]}>{settings.nickname.trim() || 'Make it yours'}</Text>
            <Text style={[styles.profileDescription, { color: theme.textSecondary }]}>
              {settings.nickname.trim() ? 'Your personal planning space' : 'Add your name to personalize Planova'}
            </Text>
          </View>
          <SmoothPressable accessibilityRole="button" onPress={openEditProfile} style={[styles.editProfileButton, { borderColor: theme.border, backgroundColor: theme.buttonSecondary }]}>
            <Text style={[styles.editProfileText, { color: theme.text }]}>Edit</Text>
            <Ionicons name="arrow-forward" size={13} color={theme.text} />
          </SmoothPressable>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Your settings</Text>
          <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>Tune Planova to fit your day.</Text>
        </View>

        <View style={[styles.menuCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {MENU_ITEMS.map((item, index) => (
            <View key={item.label}>
              <SmoothPressable
                accessibilityRole="button"
                accessibilityLabel={`${item.label}. ${item.description}`}
                accessibilityState={item.label === 'Preferences'
                  ? { expanded: preferencesExpanded }
                  : item.label === 'Notifications'
                    ? { expanded: notificationsExpanded }
                  : undefined}
                onPress={() => handleMenuItem(item.label)}
                style={[styles.menuRow, (index < MENU_ITEMS.length - 1 || (item.label === 'Preferences' && preferencesExpanded) || (item.label === 'Notifications' && notificationsExpanded)) && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
              >
                <View style={[styles.menuIcon, { backgroundColor: theme.buttonSecondary }]}>
                  <Ionicons name={item.icon} size={17} color={theme.tint} />
                </View>
                <View style={styles.menuCopy}>
                  <Text style={[styles.menuLabel, { color: theme.text }]}>{item.label}</Text>
                  <Text style={[styles.menuDescription, { color: theme.textSecondary }]}>{item.description}</Text>
                </View>
                <Ionicons name={(item.label === 'Preferences' && preferencesExpanded) || (item.label === 'Notifications' && notificationsExpanded) ? 'chevron-up' : 'chevron-forward'} size={16} color={theme.textSecondary} />
              </SmoothPressable>
              {item.label === 'Preferences' && preferencesExpanded && (
                <View style={[styles.preferencesPanel, { borderBottomColor: theme.border }]}>
                  <View style={[styles.appearanceRow, { borderBottomColor: theme.border }]}>
                    <View style={styles.appearanceCopy}>
                      <Text style={[styles.preferenceLabel, { color: theme.text }]}>Appearance</Text>
                      <Text style={[styles.preferenceHint, { color: theme.textSecondary }]}>Override to light or dark mode</Text>
                    </View>
                    <View style={[styles.appearanceSwitch, { backgroundColor: theme.background }]}>
                      {APPEARANCE_OPTIONS.map((option) => {
                        const active = settings.theme === option.id;
                        return (
                          <SmoothPressable
                            key={option.id}
                            accessibilityRole="radio"
                            accessibilityLabel={`${option.label} mode`}
                            accessibilityState={{ checked: active }}
                            onPress={() => void update('theme', option.id)}
                            style={[styles.appearanceOption, active && { backgroundColor: theme.buttonSecondary }]}
                          >
                            <Ionicons name={option.icon} size={12} color={active ? theme.text : theme.textSecondary} />
                            <Text style={[styles.appearanceOptionText, { color: active ? theme.text : theme.textSecondary }]}>{option.label}</Text>
                          </SmoothPressable>
                        );
                      })}
                    </View>
                  </View>
                  <PreferenceValue label="Default view on MyPlan" value="Day" theme={theme} />
                  <PreferenceValue label="Start of week" value="Monday" theme={theme} />
                  <PreferenceValue label="Language" value="English" theme={theme} last />
                </View>
              )}
              {item.label === 'Notifications' && notificationsExpanded && (
                <View style={[styles.notificationsPanel, { borderBottomColor: theme.border }]}>
                  {NOTIFICATION_ITEMS.map((notification, notificationIndex) => (
                    <View key={notification} style={[styles.notificationRow, notificationIndex < NOTIFICATION_ITEMS.length - 1 && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                      <Text style={[styles.notificationLabel, { color: theme.textSecondary }]}>{notification}</Text>
                      <Text style={[styles.notificationEnabled, { color: theme.tint }]}>Enabled</Text>
                    </View>
                  ))}
                  <Text style={[styles.notificationHint, { color: theme.textSecondary }]}>Manage alarm sounds and intervals per task in MyPlan.</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal visible={editVisible} transparent statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={() => setEditVisible(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SmoothPressable accessibilityRole="button" accessibilityLabel="Close profile editor" onPress={() => setEditVisible(false)} style={styles.modalScrim} />
          <View style={[styles.editCard, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeading}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Edit Profile</Text>
              <SmoothPressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setEditVisible(false)} style={styles.closeButton}>
                <Ionicons name="close" size={18} color={theme.textSecondary} />
              </SmoothPressable>
            </View>
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>NAME</Text>
            <TextInput
              accessibilityLabel="Profile name"
              value={nameDraft}
              onChangeText={setNameDraft}
              maxLength={30}
              placeholder="Your Name"
              placeholderTextColor={theme.textSecondary}
              returnKeyType="done"
              onSubmitEditing={() => void saveProfile()}
              style={[styles.nameInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.inputBackground }]}
            />
            {settings.profilePhotoUri && (
              <SmoothPressable accessibilityRole="button" disabled={photoBusy} onPress={() => void removeProfilePhoto()} style={styles.removePhotoButton}>
                <Ionicons name="trash-outline" size={14} color={theme.danger} />
                <Text style={[styles.removePhotoText, { color: theme.danger }]}>Remove photo</Text>
              </SmoothPressable>
            )}
            <View style={styles.modalActions}>
              <SmoothPressable accessibilityRole="button" onPress={() => setEditVisible(false)} style={[styles.cancelButton, { backgroundColor: theme.buttonSecondary }]}>
                <Text style={[styles.cancelText, { color: theme.text }]}>Cancel</Text>
              </SmoothPressable>
              <SmoothPressable accessibilityRole="button" disabled={saving || photoBusy} onPress={() => void saveProfile()} style={[styles.saveButton, { backgroundColor: theme.tint }, (saving || photoBusy) && styles.disabledButton]}>
                <Text style={[styles.saveText, { color: theme.background }]}>{saving ? 'Saving...' : 'Save'}</Text>
              </SmoothPressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function PreferenceValue({ label, value, theme, last = false }: { label: string; value: string; theme: ReturnType<typeof useTheme>; last?: boolean }) {
  return (
    <View style={[styles.preferenceValueRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}>
      <Text style={[styles.preferenceValueLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.preferenceValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 30 },
  pageTitle: { fontSize: 24, fontWeight: '800', letterSpacing: 0.2, marginBottom: 18 },
  profileCard: { minHeight: 138, flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 23, borderWidth: 1, padding: 18, marginBottom: 25, elevation: 4, shadowColor: '#000000', shadowOpacity: 0.24, shadowRadius: 16, shadowOffset: { width: 0, height: 7 } },
  avatarWrap: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  avatarPhoto: { width: '100%', height: '100%', borderRadius: 32 },
  avatarInitial: { fontSize: 27, fontWeight: '800' },
  avatarEdit: { position: 'absolute', right: -1, bottom: -1, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  profileDetails: { flex: 1, minWidth: 0 },
  profileEyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4 },
  profileName: { fontSize: 17, fontWeight: '800' },
  profileDescription: { fontSize: 10, lineHeight: 15, marginTop: 4 },
  editProfileButton: { minHeight: 34, paddingHorizontal: 10, borderRadius: 17, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  editProfileText: { fontSize: 10, fontWeight: '700' },
  sectionHeading: { marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  sectionDescription: { fontSize: 11, marginTop: 4 },
  menuCard: { borderRadius: 21, borderWidth: 1, overflow: 'hidden', elevation: 3, shadowColor: '#000000', shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 5 } },
  menuRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 12 },
  menuIcon: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  menuCopy: { flex: 1, minWidth: 0, gap: 3 },
  menuLabel: { fontSize: 12, fontWeight: '700' },
  menuDescription: { fontSize: 10 },
  preferencesPanel: { paddingHorizontal: 14, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  appearanceRow: { minHeight: 69, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  appearanceCopy: { flex: 1, minWidth: 0 },
  preferenceLabel: { fontSize: 11, fontWeight: '600' },
  preferenceHint: { fontSize: 9, lineHeight: 12, marginTop: 3, maxWidth: 120 },
  appearanceSwitch: { flexDirection: 'row', padding: 3, borderRadius: 19, gap: 3 },
  appearanceOption: { minWidth: 47, minHeight: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 5 },
  appearanceOptionText: { fontSize: 8, fontWeight: '600' },
  preferenceValueRow: { minHeight: 37, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  preferenceValueLabel: { fontSize: 10 },
  preferenceValue: { fontSize: 10, fontWeight: '600' },
  notificationsPanel: { paddingHorizontal: 14, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  notificationRow: { minHeight: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  notificationLabel: { fontSize: 10 },
  notificationEnabled: { fontSize: 10, fontWeight: '700' },
  notificationHint: { fontSize: 9, marginTop: 6 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: 'rgba(3, 14, 9, 0.82)' },
  modalScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'transparent' },
  editCard: { borderRadius: 18, padding: 18 },
  modalHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  closeButton: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  inputLabel: { fontSize: 9, fontWeight: '700', marginBottom: 6 },
  nameInput: { minHeight: 42, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 13 },
  removePhotoButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9 },
  removePhotoText: { fontSize: 11, fontWeight: '600' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  cancelButton: { minHeight: 38, paddingHorizontal: 14, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 11, fontWeight: '600' },
  saveButton: { minHeight: 38, minWidth: 76, paddingHorizontal: 16, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 11, fontWeight: '700' },
  disabledButton: { opacity: 0.6 },
});