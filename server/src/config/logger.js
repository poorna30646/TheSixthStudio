    const timestamp = () => new Date().toISOString();

const logger = {
  info(message) {
    console.log(`[INFO] ${timestamp()} - ${message}`);
  },

  success(message) {
    console.log(`[SUCCESS] ${timestamp()} - ${message}`);
  },

  warn(message) {
    console.warn(`[WARNING] ${timestamp()} - ${message}`);
  },

  error(message) {
    console.error(`[ERROR] ${timestamp()} - ${message}`);
  },
};

export default logger;