import { Module } from '@nestjs/common';
import { CLOCK, CollaborationService } from './collaboration.service.js';
import {
  MyCollaborationsController,
  ReceivedCollaborationsController,
} from './collaborations.controller.js';

@Module({
  controllers: [MyCollaborationsController, ReceivedCollaborationsController],
  providers: [
    CollaborationService,
    { provide: CLOCK, useValue: () => new Date() },
  ],
})
export class CollaborationsModule {}
