import { IUser } from '../models/User';
import { IClientMembership } from '../models/ClientMembership';
import { JwtPayload } from '../services/auth.service';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      auth?: JwtPayload;
      resolvedClientId?: string;
      clientMembership?: IClientMembership;
    }
  }
}
