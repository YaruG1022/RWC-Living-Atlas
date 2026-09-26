import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'https://cereo-backend.onrender.com',
  timeout: 90000, // 90 second timeout — accounts for Render free-tier cold start (~30-90s)
  //https://verdant-smakager-ef450d.netlify.app    //Netlify Frontend Link
});

// Add request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log('DEBUG: API Request:', {
      method: config.method?.toUpperCase(),
      url: config.baseURL + config.url,
      data: config.data,
      headers: config.headers
    });
    return config;
  },
  (error) => {
    console.error('DEBUG: API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging + cold-start retry
api.interceptors.response.use(
  (response) => {
    console.log('DEBUG: API Response:', {
      status: response.status,
      statusText: response.statusText,
      data: response.data,
      headers: response.headers
    });
    return response;
  },
  (error) => {
    console.error('DEBUG: API Response Error:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      config: {
        method: error.config?.method,
        url: error.config?.url,
        baseURL: error.config?.baseURL
      }
    });

    const config = error.config;
    // Retry once on timeout or network error (handles Render cold start)
    if (
      config &&
      !config._retried &&
      (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK' || !error.response)
    ) {
      config._retried = true;
      console.warn('DEBUG: Retrying request after cold-start timeout...', config.url);
      return new Promise((resolve) => setTimeout(resolve, 2000)).then(() => api(config));
    }

    return Promise.reject(error);
  }
);

export default api; 
