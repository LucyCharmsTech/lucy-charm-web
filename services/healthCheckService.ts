// services/userService.ts
import api from '../lib/axios';

export const testHealth = () => api.get('/health');
