import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    admin?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    admin?: boolean;
  }
}
