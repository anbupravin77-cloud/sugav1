import caseDetailHandler from '../../../lib/handlers/case-detail.js';
import planHandler from '../../../lib/handlers/plan.js';
import reviewHandler from '../../../lib/handlers/review.js';
import aiDraftHandler from '../../../lib/handlers/ai-draft.js';
import notesHandler from '../../../lib/handlers/notes.js';
import prescriptionHandler from '../../../lib/handlers/prescription.js';

// This single file replaces:
//   api/cases/[id]/index.js
//   api/cases/[id]/plan.js
//   api/cases/[id]/review.js
//   api/cases/[id]/ai-draft.js
//   api/cases/[id]/notes.js
//   api/cases/[id]/prescription.js
//
// It routes based on the URL segment after the case id, e.g.:
//   /api/cases/123           -> action = []              -> case-detail handler
//   /api/cases/123/plan      -> action = ['plan']         -> plan handler
//   /api/cases/123/review    -> action = ['review']       -> review handler
//   /api/cases/123/ai-draft  -> action = ['ai-draft']      -> ai-draft handler
//   /api/cases/123/notes     -> action = ['notes']         -> notes handler
//   /api/cases/123/prescription -> action = ['prescription'] -> prescription handler

export default function handler(req, res) {
  const { action } = req.query;
  const segment = Array.isArray(action) ? action[0] : action;

  switch (segment) {
    case undefined:
      // /api/cases/[id] with no extra segment
      return caseDetailHandler(req, res);
    case 'plan':
      return planHandler(req, res);
    case 'review':
      return reviewHandler(req, res);
    case 'ai-draft':
      return aiDraftHandler(req, res);
    case 'notes':
      return notesHandler(req, res);
    case 'prescription':
      return prescriptionHandler(req, res);
    default:
      res.status(404).json({ error: 'Not found' });
  }
}