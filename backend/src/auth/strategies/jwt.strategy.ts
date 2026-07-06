import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: number;
  username: string;
  role: string;
  teamId: number | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') || 'change-this-secret',
    });
  }

  async validate(payload: JwtPayload) {
    return {
      id: payload.sub,
      username: payload.username,
      role: payload.role,
      teamId: payload.teamId,
    };
  }
}
