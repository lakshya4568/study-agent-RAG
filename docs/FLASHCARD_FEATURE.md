# Flashcard Feature Implementation Documentation

## Overview
The Flashcard Feature allows users to generate interactive study flashcards from their chat context or uploaded documents. The system uses an LLM (via LangGraph) to generate structured JSON data, which is then persisted in a local SQLite database and rendered in a React-based interactive viewer.

## Architecture

### Data Flow
1. **User Request**: User clicks "Flashcards" quick action or asks to generate flashcards.
2. **Agent Workflow**:
   - The request is routed to the `flashcardNode` in the LangGraph workflow.
   - The LLM generates a JSON response containing an array of flashcards (Question, Answer, Difficulty, Tags).
3. **Frontend Processing** (`Chat.tsx`):
   - The `Chat` component detects the JSON structure.
   - It assigns unique IDs (UUIDs) to each card.
   - **Persistence**: It saves the Assistant Message *first*, then saves each Flashcard to the SQLite database.
   - **State Update**: The enriched flashcard data is stored in the message history.
4. **Rendering**:
   - `MessageBubble` detects flashcard data and renders the `FlashcardViewer` component instead of plain text.
   - `FlashcardViewer` manages its own state (flipping, navigation) but syncs "Mastered" status with the database.

## Database Schema

### Table: `flashcards`
| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PRIMARY KEY | Unique UUID for the flashcard. |
| `set_id` | TEXT | Identifier for the group of cards generated together. |
| `question` | TEXT | The front side of the card. |
| `answer` | TEXT | The back side of the card. |
| `difficulty` | TEXT | 'easy', 'medium', or 'hard'. |
| `tags` | TEXT | JSON stringified array of tags. |
| `is_mastered` | INTEGER | Boolean (0 or 1) indicating if the user has mastered the card. |
| `created_at` | INTEGER | Timestamp of creation. |
| `message_id` | TEXT | Foreign Key linking to the `messages` table. |

### IPC Methods
Exposed via `window.db`:
- `saveFlashcard(card)`: Inserts a new flashcard.
- `getFlashcardsByMessageId(messageId)`: Retrieves all cards for a specific chat message.
- `updateFlashcardStatus(id, isMastered)`: Toggles the mastery status.

## Components

### `src/views/Chat.tsx`
- **Role**: Orchestrator of the chat interface.
- **Key Logic**:
  - Handles the "Flashcard" quick action.
  - Parses LLM JSON output.
  - Ensures data integrity by saving the Message before the Flashcards.
  - Handles errors during generation or parsing.

### `src/components/ui/FlashcardViewer.tsx`
- **Role**: Interactive UI for studying.
- **Features**:
  - **Flipping**: 3D rotation using `framer-motion`.
  - **Navigation**: Next/Prev buttons and Keyboard support (Arrow keys, Space/Enter).
  - **Mastery Tracking**: "Mark as Mastered" button updates local state and persists to DB immediately.
  - **Export**: Download current set as JSON.
  - **Shuffle**: Randomize card order.

### `src/agent/nodes.ts` & `graph.ts`
- **`flashcardNode`**: A specialized LangGraph node that uses a strict system prompt to force the LLM to output valid JSON conforming to the `Flashcard` schema.
- **Routing**: The graph router detects keywords (e.g., "flashcard") and directs the flow to `flashcardNode`.

## Usage
1. **Generate**: Click the "Flashcards" button in the Quick Actions menu or type "Create flashcards about [topic]".
2. **Study**:
   - Click a card to flip it.
   - Use Arrow keys to navigate.
   - Click "Mark as Mastered" to track progress.
3. **Review**: The mastery status is saved, so revisiting the chat history will show the updated status.
