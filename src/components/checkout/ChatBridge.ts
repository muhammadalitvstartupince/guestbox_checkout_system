/**
 * Bridge between ChatWidget and CheckoutForm.
 *
 * The form registers its state + setters here. The chat widget (and the
 * /api/chat route via tool calls) reads/writes through this bridge.
 * This avoids wrapping everything in a context provider and refactoring
 * CheckoutForm's internal state management.
 */

export interface ChatBridgeState {
  // Read-only form state
  wizardStep: 1 | 2 | 3;
  detailsSubStep: "personal" | "address" | "billing-cycle";
  quantity: number;
  listingQty: number;
  selectedPlanId: string;
  selectedTierId: string;
  selectedTierInterval: string;
  selectedAddonIds: string[];
  upgradeSelected: boolean;
  orderId: string | null;
  // Profile/address info the user has filled (read-only for bot context)
  profileForm: { firstName: string; lastName: string; email: string; phone: string };
  addressFilled: boolean;

  // Setters
  setWizardStep: (step: 1 | 2 | 3) => void;
  setQuantity: (qty: number | ((prev: number) => number)) => void;
  setListingQty: (qty: number | ((prev: number) => number)) => void;
  setSelectedPlanId: (id: string) => void;
  setSelectedTierId: (id: string) => void;
  setSelectedTierInterval: (interval: string) => void;
  setSelectedAddonIds: (ids: string[]) => void;
  setUpgradeSelected: (v: boolean) => void;
  setDetailsSubStep: (sub: "personal" | "address" | "billing-cycle") => void;
}

// Global mutable ref — only one checkout form exists at a time
let bridge: ChatBridgeState | null = null;
// Chat conversation ID — set by ChatWidget, read by CheckoutForm
let chatConversationId: string | null = null;

export function registerChatBridge(state: ChatBridgeState) {
  bridge = state;
}

export function unregisterChatBridge() {
  bridge = null;
}

export function getChatBridge(): ChatBridgeState | null {
  return bridge;
}

export function setChatConversationId(id: string | null) {
  chatConversationId = id;
}

export function getChatConversationId(): string | null {
  return chatConversationId;
}
