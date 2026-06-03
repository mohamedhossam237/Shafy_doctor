// /lib/cache.js

const globalCache = {
  dashboard: null,
  appointments: null,
  history: null,
  patients: null,
  clear() {
    this.dashboard = null;
    this.appointments = null;
    this.history = null;
    this.patients = null;
  }
};

export default globalCache;
