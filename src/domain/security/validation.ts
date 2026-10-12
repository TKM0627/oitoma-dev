import { z } from 'zod';

// CSPのunsafe-evalを不要にする。
z.config({ jitless: true });
export { z };
