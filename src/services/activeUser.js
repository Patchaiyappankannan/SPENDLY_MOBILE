let activeUserId = null;

export function setActiveUserId(id) {
  activeUserId = id == null ? null : String(id);
}

export function getActiveUserId() {
  return activeUserId;
}