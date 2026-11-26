import { request } from './api';
import { getSetting, setSetting } from '../repositories/settingsRepo';

const PHOTO_DATA_KEY = 'profile_photo_data';
const PHOTO_MIME_KEY = 'profile_photo_mime';
const PHOTO_PENDING_KEY = 'profile_photo_pending';

export async function getLocalProfilePhoto() {
  const data = await getSetting(PHOTO_DATA_KEY, '');
  if (!data) return null;
  return { data, mimeType: await getSetting(PHOTO_MIME_KEY, 'image/jpeg') };
}

async function storeLocalProfilePhoto(photo) {
  await setSetting(PHOTO_DATA_KEY, photo.data);
  await setSetting(PHOTO_MIME_KEY, photo.mimeType);
}

export async function saveProfilePhoto(photo) {
  await storeLocalProfilePhoto(photo);
  await setSetting(PHOTO_PENDING_KEY, '1');
  return syncPendingProfilePhoto();
}

export async function syncPendingProfilePhoto() {
  try {
    if (await getSetting(PHOTO_PENDING_KEY, '0') !== '1') return false;
    const photo = await getLocalProfilePhoto();
    if (!photo) return false;
    await request('/auth/profile/photo', { method: 'PUT', body: photo });
    await setSetting(PHOTO_PENDING_KEY, '0');
    return true;
  } catch {
    return false;
  }
}

export async function syncProfilePhoto() {
  const local = await getLocalProfilePhoto();
  const pending = await getSetting(PHOTO_PENDING_KEY, '0');

  if (pending === '1') {
    await syncPendingProfilePhoto();
    return local;
  }

  try {
    const remote = await request('/auth/profile/photo');
    if (remote.data && remote.mimeType) {
      const photo = { data: remote.data, mimeType: remote.mimeType };
      await storeLocalProfilePhoto(photo);
      await setSetting(PHOTO_PENDING_KEY, '0');
      return photo;
    }
  } catch {}

  return local;
}
