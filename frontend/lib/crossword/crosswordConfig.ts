import { createCrosswordSampleTicket } from "./crosswordSampleTicket";
import type { CrosswordTicketData, CrosswordTicketTier } from "./crosswordTypes";

export function createCrosswordTicket(args: {
  ticketId: CrosswordTicketTier;
  rewardAmount: number;
  sessionId: string;
  selectionSeed?: string;
  avoidTemplateId?: string | null;
  avoidTemplateFamilyId?: string | null;
}): CrosswordTicketData {
  return createCrosswordSampleTicket(args);
}
