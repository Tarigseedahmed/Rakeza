const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rakeza', Object.freeze({
  getDeployment: () => ipcRenderer.invoke('deployment:get'),
  resetDeployment: () => ipcRenderer.invoke('deployment:reset'),
  saveDeployment: (value) => ipcRenderer.invoke('deployment:save', value),
  chooseTlsFiles: () => ipcRenderer.invoke('deployment:choose-tls'),
  getToken: () => ipcRenderer.invoke('auth:get-token'),
  setToken: (token) => ipcRenderer.invoke('auth:set-token', token),
  clearToken: () => ipcRenderer.invoke('auth:clear-token'),
  getNotificationSettings: () => ipcRenderer.invoke('notifications:get-settings'),
  setNotificationsEnabled: (enabled) => ipcRenderer.invoke('notifications:set-enabled', enabled),
  logout: () => ipcRenderer.invoke('app:logout'),
}));
