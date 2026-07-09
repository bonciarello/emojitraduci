<template>
  <div class="app">
    <!-- Header -->
    <header class="header">
      <div class="header-inner">
        <h1 class="logo">
          <span class="logo-emoji" aria-hidden="true">🔤➡️😊</span>
          <span class="logo-text">EmojiTraduci</span>
        </h1>
        <p class="tagline">Scrivi in italiano, traduci in emoji, modifica e copia.</p>
      </div>
    </header>

    <!-- Main -->
    <main class="main">
      <!-- Input area -->
      <section class="input-section" aria-labelledby="input-label">
        <label id="input-label" for="text-input" class="input-label">
          La tua frase in italiano
        </label>
        <textarea
          id="text-input"
          ref="inputRef"
          v-model="inputText"
          class="text-input"
          placeholder="Scrivi o incolla una frase… ad esempio: cane gatto sole"
          rows="3"
          autofocus
          @input="onInput"
          @keydown.escape="closePicker"
        ></textarea>
      </section>

      <!-- Preview area -->
      <section
        v-if="tokens.length > 0"
        class="preview-section"
        aria-labelledby="preview-label"
      >
        <h2 id="preview-label" class="section-title">Anteprima emoji</h2>

        <div class="emoji-preview">
          <template v-for="(token, idx) in tokens" :key="idx">
            <!-- Space token -->
            <span v-if="token.type === 'space'" class="token-space">{{ token.text }}</span>

            <!-- Punctuation token -->
            <span v-else-if="token.type === 'punctuation'" class="token-punct">{{ token.text }}</span>

            <!-- Word token: emoji pill (if resolved) or plain word -->
            <span
              v-else-if="token.type === 'word' && token.resolvedEmoji"
              class="emoji-pill"
              :class="{ 'emoji-pill--active': activeTokenIndex === idx }"
              role="button"
              tabindex="0"
              :aria-label="'Emoji per «' + token.originalText + '»: ' + token.resolvedEmoji + '. Premi Invio o Spazio per cambiare.'"
              @click="openPicker(idx, $event)"
              @keydown.enter.prevent="openPicker(idx, $event)"
              @keydown.space.prevent="openPicker(idx, $event)"
            >
              <span class="emoji-pill__emoji">{{ token.resolvedEmoji }}</span>
              <span class="emoji-pill__word">{{ token.originalText }}</span>
            </span>

            <!-- Word token: no emoji found, show original -->
            <span v-else class="token-plain">{{ token.text }}</span>
          </template>
        </div>

        <!-- Alternative picker popover -->
        <Teleport to="body">
          <div
            v-if="activeTokenIndex !== null && activeToken && activeToken.emojis && activeToken.emojis.length > 1"
            class="picker-overlay"
            @click="closePicker"
            @keydown.escape="closePicker"
          >
            <div
              ref="pickerRef"
              class="picker-popover"
              :style="pickerStyle"
              role="dialog"
              aria-label="Scegli un'emoji alternativa per «{{ activeToken?.originalText }}»"
              @click.stop
            >
              <div class="picker-header">
                <span class="picker-word">{{ activeToken?.originalText }}</span>
              </div>
              <div class="picker-grid">
                <button
                  v-for="(emoji, eIdx) in activeToken.emojis"
                  :key="eIdx"
                  class="picker-option"
                  :class="{ 'picker-option--selected': eIdx === activeToken.resolvedIndex }"
                  :aria-label="'Emoji ' + emoji"
                  :aria-pressed="eIdx === activeToken.resolvedIndex"
                  @click="selectAlternative(eIdx)"
                  @keydown.enter="selectAlternative(eIdx)"
                  @keydown.space.prevent="selectAlternative(eIdx)"
                >
                  {{ emoji }}
                </button>
              </div>
              <button
                class="picker-revert"
                @click="revertWord"
                @keydown.enter="revertWord"
                @keydown.space.prevent="revertWord"
              >
                Mostra parola originale
              </button>
            </div>
          </div>
        </Teleport>
      </section>

      <!-- Empty state -->
      <section v-else class="empty-state" aria-live="polite">
        <div class="empty-icon" aria-hidden="true">✨</div>
        <p class="empty-text">Scrivi qualcosa qui sopra e guardala trasformarsi in emoji.</p>
        <p class="empty-hint">Prova con: <button type="button" class="hint-link" @click="setExample('cane gatto sole')">cane gatto sole</button></p>
      </section>

      <!-- Actions bar -->
      <div v-if="hasTranslatedTokens" class="actions-bar">
        <button
          class="btn-copy"
          :class="{ 'btn-copy--success': copied }"
          @click="copyResult"
        >
          <svg v-if="!copied" class="btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          <svg v-else class="btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>{{ copied ? 'Copiato negli appunti!' : 'Copia risultato emoji' }}</span>
        </button>
      </div>
    </main>

    <!-- Footer -->
    <footer class="footer">
      <p class="footer-text">EmojiTraduci — il traduttore di frasi in emoji, tutto in locale. Nessun dato inviato.</p>
    </footer>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { translate } from './emoji-db.js';

/* ── State ───────────────────────────────── */

const inputText = ref('');
const tokens = ref([]);
const activeTokenIndex = ref(null);
const copied = ref(false);
const copyTimeout = ref(null);

const inputRef = ref(null);
const pickerRef = ref(null);

const pickerStyle = reactive({
  top: '0px',
  left: '0px',
});

/* ── Computed ────────────────────────────── */

const hasTranslatedTokens = computed(() => {
  return tokens.value.some(t => t.type === 'word' && t.resolvedEmoji);
});

const activeToken = computed(() => {
  if (activeTokenIndex.value === null) return null;
  return tokens.value[activeTokenIndex.value] || null;
});

/* ── Methods ─────────────────────────────── */

function onInput() {
  tokens.value = translate(inputText.value);
  closePicker();
}

function setExample(text) {
  inputText.value = text;
  tokens.value = translate(text);
  closePicker();
  nextTick(() => inputRef.value?.focus());
}

function openPicker(idx, event) {
  if (activeTokenIndex.value === idx) {
    closePicker();
    return;
  }
  activeTokenIndex.value = idx;

  // Posiziona il popover vicino al pill cliccato
  nextTick(() => {
    positionPicker(event?.currentTarget);
  });
}

function positionPicker(targetEl) {
  if (!targetEl) return;
  const rect = targetEl.getBoundingClientRect();
  const pickerWidth = 280;
  const gap = 8;

  let left = rect.left + rect.width / 2 - pickerWidth / 2;
  // Non uscire dai bordi
  if (left < 12) left = 12;
  if (left + pickerWidth > window.innerWidth - 12) left = window.innerWidth - pickerWidth - 12;

  let top = rect.bottom + gap;
  // Se non c'è spazio sotto, metti sopra
  if (top + 200 > window.innerHeight) {
    top = rect.top - 200 - gap;
  }

  pickerStyle.top = `${top}px`;
  pickerStyle.left = `${left}px`;
}

function selectAlternative(emojiIndex) {
  if (activeTokenIndex.value === null) return;
  const token = tokens.value[activeTokenIndex.value];
  if (!token || !token.emojis || emojiIndex >= token.emojis.length) return;

  token.resolvedEmoji = token.emojis[emojiIndex];
  token.resolvedIndex = emojiIndex;
  closePicker();
}

function revertWord() {
  if (activeTokenIndex.value === null) return;
  const token = tokens.value[activeTokenIndex.value];
  if (!token) return;
  token.resolvedEmoji = null;
  token.resolvedIndex = -1;
  closePicker();
}

function closePicker() {
  activeTokenIndex.value = null;
}

async function copyResult() {
  // Costruisce la stringa di sole emoji
  const parts = tokens.value.map(t => {
    if (t.type === 'word' && t.resolvedEmoji) return t.resolvedEmoji;
    if (t.type === 'space') return ' ';
    if (t.type === 'word' && !t.resolvedEmoji) return t.text;
    return '';
  });
  const emojiString = parts.join('').replace(/\s+/g, ' ').trim();

  if (!emojiString) return;

  try {
    await navigator.clipboard.writeText(emojiString);
    copied.value = true;
    if (copyTimeout.value) clearTimeout(copyTimeout.value);
    copyTimeout.value = setTimeout(() => {
      copied.value = false;
    }, 2500);
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = emojiString;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      copied.value = true;
      if (copyTimeout.value) clearTimeout(copyTimeout.value);
      copyTimeout.value = setTimeout(() => {
        copied.value = false;
      }, 2500);
    } catch { /* ignore */ }
    document.body.removeChild(textarea);
  }
}

/* ── Click outside to close picker ───────── */

function onDocumentClick(e) {
  if (activeTokenIndex.value === null) return;
  // Se il click è su un emoji-pill, lascia che sia il suo handler a decidere
  const pill = e.target.closest('.emoji-pill');
  if (pill) return;
  closePicker();
}

/* ── Lifecycle ───────────────────────────── */

onMounted(() => {
  document.addEventListener('click', onDocumentClick);
});

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick);
  if (copyTimeout.value) clearTimeout(copyTimeout.value);
});
</script>

<style scoped>
/* ==========================================
   App Layout
   ========================================== */

.app {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-4) var(--space-4) var(--space-8);
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

/* ── Header ─────────────────────────────── */

.header {
  padding: var(--space-6) 0 var(--space-4);
  text-align: center;
}

.header-inner {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
}

.logo {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: var(--text-3xl);
  color: var(--color-text);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.logo-emoji {
  font-size: 1.1em;
}

.logo-text {
  background: linear-gradient(135deg, var(--color-secondary) 0%, var(--color-tertiary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.tagline {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  line-height: 1.4;
}

/* ── Main ────────────────────────────────── */

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

/* ── Input Section ───────────────────────── */

.input-section {
  background: var(--color-card);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  box-shadow: var(--shadow-sm);
  transition: border-color var(--duration-fast) var(--ease-out);
}

.input-section:focus-within {
  border-color: var(--color-tertiary);
  box-shadow: var(--shadow-md), 0 0 0 3px rgba(108, 92, 231, 0.1);
}

.input-label {
  display: block;
  font-family: var(--font-display);
  font-weight: 500;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-2);
  letter-spacing: -0.01em;
}

.text-input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-family: var(--font-body);
  font-size: var(--text-lg);
  line-height: 1.6;
  color: var(--color-text);
  resize: vertical;
  min-height: 72px;
  padding: 0;
  caret-color: var(--color-tertiary);
}

.text-input::placeholder {
  color: var(--color-text-muted);
  opacity: 1;
}

/* ── Preview Section ─────────────────────── */

.preview-section {
  background: var(--color-card);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  box-shadow: var(--shadow-sm);
}

.section-title {
  font-family: var(--font-display);
  font-weight: 500;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-3);
  letter-spacing: -0.01em;
}

.emoji-preview {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1);
  row-gap: var(--space-2);
  line-height: 1;
  min-height: 40px;
}

/* ── Token styles ────────────────────────── */

.token-space {
  width: 0.35em;
  flex-shrink: 0;
}

.token-punct {
  font-size: var(--text-lg);
  color: var(--color-text-secondary);
  line-height: 1;
}

.token-plain {
  font-size: var(--text-base);
  color: var(--color-text-muted);
  line-height: 1.8;
  padding: var(--space-1) 0;
}

/* ── Emoji Pill ──────────────────────────── */

.emoji-pill {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  background: var(--color-primary-light);
  border: 1.5px solid transparent;
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  user-select: none;
  transition:
    background var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
  min-width: 52px;
  min-height: 60px;
  justify-content: center;
  position: relative;
}

.emoji-pill:hover {
  background: var(--color-primary);
  border-color: var(--color-primary-hover);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.emoji-pill:focus-visible {
  outline: 2.5px solid var(--color-focus-ring);
  outline-offset: 2px;
  border-radius: var(--radius-md);
}

.emoji-pill--active {
  background: var(--color-primary);
  border-color: var(--color-primary-hover);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.emoji-pill__emoji {
  font-size: 1.5rem;
  line-height: 1;
  transition: transform var(--duration-fast) var(--ease-spring);
}

.emoji-pill:hover .emoji-pill__emoji,
.emoji-pill--active .emoji-pill__emoji {
  transform: scale(1.2);
}

.emoji-pill__word {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  font-weight: 500;
  line-height: 1;
  max-width: 64px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Picker Popover ──────────────────────── */

.picker-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: transparent;
}

.picker-popover {
  position: fixed;
  z-index: 101;
  background: var(--color-card);
  border: 1.5px solid var(--color-border-strong);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  box-shadow: var(--shadow-pop);
  min-width: 220px;
  max-width: 300px;
  animation: pickerIn var(--duration-normal) var(--ease-spring);
}

@keyframes pickerIn {
  from {
    opacity: 0;
    transform: scale(0.85) translateY(-8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.picker-header {
  padding: var(--space-1) var(--space-2) var(--space-2);
  border-bottom: 1px solid var(--color-border);
  margin-bottom: var(--space-2);
}

.picker-word {
  font-family: var(--font-display);
  font-weight: 500;
  font-size: var(--text-sm);
  color: var(--color-text);
}

.picker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
  gap: var(--space-2);
  padding: var(--space-1) 0;
}

.picker-option {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1;
  font-size: 1.75rem;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-spring);
  padding: 0;
  line-height: 1;
  min-width: 44px;
  min-height: 44px;
}

.picker-option:hover {
  background: var(--color-primary-light);
  border-color: var(--color-primary);
  transform: scale(1.12);
}

.picker-option:focus-visible {
  outline: 2.5px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.picker-option--selected {
  background: var(--color-primary);
  border-color: var(--color-primary-hover);
  box-shadow: 0 0 0 3px rgba(255, 184, 0, 0.25);
}

.picker-revert {
  display: block;
  width: 100%;
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: 1.5px dashed var(--color-border-strong);
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
  min-height: 44px;
}

.picker-revert:hover {
  background: var(--color-surface);
  border-color: var(--color-text-muted);
  color: var(--color-text);
}

.picker-revert:focus-visible {
  outline: 2.5px solid var(--color-focus-ring);
  outline-offset: 2px;
}

/* ── Empty State ─────────────────────────── */

.empty-state {
  text-align: center;
  padding: var(--space-8) var(--space-4);
  background: var(--color-card);
  border: 1.5px dashed var(--color-border-strong);
  border-radius: var(--radius-lg);
}

.empty-icon {
  font-size: 2.5rem;
  margin-bottom: var(--space-3);
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

.empty-text {
  font-size: var(--text-base);
  color: var(--color-text-secondary);
  line-height: 1.5;
  max-width: 400px;
  margin: 0 auto;
}

.empty-hint {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  margin-top: var(--space-3);
}

.hint-link {
  background: none;
  border: none;
  border-bottom: 1.5px dashed var(--color-tertiary);
  color: var(--color-tertiary);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  cursor: pointer;
  padding: 2px 0;
  transition: color var(--duration-fast) var(--ease-out);
  min-height: 44px;
  min-width: 44px;
}

.hint-link:hover {
  color: var(--color-tertiary-hover);
  border-bottom-style: solid;
}

.hint-link:focus-visible {
  outline: 2.5px solid var(--color-focus-ring);
  outline-offset: 2px;
  border-radius: 2px;
}

/* ── Actions Bar ─────────────────────────── */

.actions-bar {
  display: flex;
  justify-content: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.btn-copy {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  background: var(--color-tertiary);
  color: white;
  border: none;
  border-radius: var(--radius-full);
  font-family: var(--font-display);
  font-weight: 500;
  font-size: var(--text-base);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
  min-height: 48px;
  box-shadow: 0 4px 16px rgba(108, 92, 231, 0.3);
}

.btn-copy:hover {
  background: var(--color-tertiary-hover);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(108, 92, 231, 0.4);
}

.btn-copy:focus-visible {
  outline: 2.5px solid var(--color-focus-ring);
  outline-offset: 3px;
}

.btn-copy:active {
  transform: translateY(0);
}

.btn-copy--success {
  background: var(--color-success);
  box-shadow: 0 4px 16px rgba(0, 184, 148, 0.3);
}

.btn-copy--success:hover {
  background: #00a381;
  box-shadow: 0 6px 20px rgba(0, 184, 148, 0.4);
}

.btn-icon {
  flex-shrink: 0;
}

/* ── Footer ──────────────────────────────── */

.footer {
  margin-top: auto;
  padding: var(--space-6) 0 var(--space-2);
  text-align: center;
}

.footer-text {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  line-height: 1.5;
}

/* ── Responsive ──────────────────────────── */

@media (min-width: 600px) {
  .app {
    padding: var(--space-6) var(--space-6) var(--space-10);
  }

  .header {
    padding: var(--space-8) 0 var(--space-5);
  }

  .logo {
    font-size: 2.25rem;
  }

  .text-input {
    font-size: var(--text-xl);
  }

  .emoji-preview {
    gap: var(--space-2);
  }
}

@media (min-width: 900px) {
  .app {
    padding: var(--space-8) var(--space-10) var(--space-10);
  }
}
</style>
