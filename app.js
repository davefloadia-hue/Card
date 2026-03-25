const STORE = "desktop_keyboard_business_v1";
const categories = ["全部", ...new Set(CARDS.map(card => card.category))];

function defaultState() {
  return {
    current: 0,
    flipped: false,
    filter: "全部",
    search: "",
    progress: Object.fromEntries(
      CARDS.map((card, index) => [index, { mastery: 0, seen: 0, know: 0, again: 0 }])
    )
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE);
    return raw ? JSON.parse(raw) : defaultState();
  } catch {
    return defaultState();
  }
}

const state = loadState();

function save() {
  localStorage.setItem(STORE, JSON.stringify(state));
}

function progressFor(index) {
  if (!state.progress[index]) {
    state.progress[index] = { mastery: 0, seen: 0, know: 0, again: 0 };
  }
  return state.progress[index];
}

function $(selector) {
  return document.querySelector(selector);
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;

  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.95;

  const voices = speechSynthesis.getVoices();
  const preferredVoice =
    voices.find(voice => /Samantha|Google US English|Alex|Daniel/i.test(voice.name)) ||
    voices.find(voice => voice.lang === "en-US") ||
    voices.find(voice => voice.lang && voice.lang.startsWith("en"));

  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  speechSynthesis.speak(utterance);
}

function filteredIndexes() {
  const query = (state.search || "").trim().toLowerCase();

  return CARDS
    .map((card, index) => [card, index])
    .filter(([card]) => {
      const matchesCategory = state.filter === "全部" || card.category === state.filter;
      const matchesQuery =
        !query ||
        card.word.toLowerCase().includes(query) ||
        card.zh.includes(query) ||
        card.example.toLowerCase().includes(query);

      return matchesCategory && matchesQuery;
    })
    .map(([, index]) => index);
}

function smartScore(index) {
  const progress = progressFor(index);
  return (100 - progress.mastery) * 0.75 + progress.again * 9 + (progress.seen === 0 ? 20 : 0) + Math.random() * 3;
}

function currentPool() {
  const indexes = filteredIndexes();
  return indexes.length ? indexes : CARDS.map((card, index) => index);
}

function nextIndex() {
  const ranked = currentPool().slice().sort((left, right) => smartScore(right) - smartScore(left));
  return ranked[0] || 0;
}

function showNotice(text) {
  const notice = $("#notice");
  notice.textContent = text;
  notice.classList.add("show");
  setTimeout(() => notice.classList.remove("show"), 900);
}

function renderTabs() {
  $("#tabs").innerHTML = categories
    .map(category => `<button class="tab ${state.filter === category ? "active" : ""}" data-cat="${category}">${category}</button>`)
    .join("");

  document.querySelectorAll(".tab").forEach(button => {
    button.onclick = () => {
      state.filter = button.dataset.cat;
      state.current = nextIndex();
      state.flipped = false;
      render();
    };
  });
}

function renderQueue() {
  const queue = currentPool().slice().sort((left, right) => smartScore(right) - smartScore(left)).slice(0, 10);

  $("#queue").innerHTML = queue
    .map(index => {
      const card = CARDS[index];
      return `<div class="queue-item ${index === state.current ? "active" : ""}" data-i="${index}"><strong>${card.word}</strong><br><span>${card.category} · ${Math.round(progressFor(index).mastery)}/100</span></div>`;
    })
    .join("");

  document.querySelectorAll(".queue-item").forEach(element => {
    element.onclick = () => {
      state.current = Number(element.dataset.i);
      state.flipped = false;
      render();
    };
  });
}

function renderStats() {
  const values = CARDS.map((card, index) => progressFor(index).mastery);
  $("#knownCount").textContent = values.filter(value => value >= 80).length;
  $("#weakCount").textContent = values.filter(value => value < 40).length;
  $("#progressNum").textContent = `${Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)}%`;
  $("#currentNum").textContent = state.current + 1;
  $("#badge").textContent = `${CARDS.length} 張卡`;
}

function renderCard() {
  const card = CARDS[state.current];
  const progress = progressFor(state.current);

  $("#metaCategory").textContent = card.category;
  $("#metaMastery").textContent = `熟悉度 ${Math.round(progress.mastery)}`;
  $("#word").textContent = card.word;
  $("#example").textContent = card.example;
  $("#zh").textContent = card.zh;
  $("#translation").textContent = card.translation;
  $("#bar").style.width = `${Math.round(progress.mastery)}%`;
  $("#card").classList.toggle("back", state.flipped);
  $("#zh").style.display = state.flipped ? "block" : "none";
  $("#translation").style.display = state.flipped ? "block" : "none";
}

function render() {
  $("#search").value = state.search || "";
  renderTabs();
  renderQueue();
  renderStats();
  renderCard();
  save();
}

function mark(kind) {
  const progress = progressFor(state.current);
  progress.seen += 1;

  if (kind === "know") {
    progress.know += 1;
    progress.mastery = Math.min(100, progress.mastery + 18);
    showNotice("會了");
  } else {
    progress.again += 1;
    progress.mastery = Math.max(0, progress.mastery - 10);
    showNotice("再練一次");
  }

  state.current = nextIndex();
  state.flipped = false;
  render();
}

$("#search").oninput = event => {
  state.search = event.target.value;
  state.current = nextIndex();
  state.flipped = false;
  render();
};

$("#flipBtn").onclick = () => {
  state.flipped = !state.flipped;
  render();
};

$("#speakBtn").onclick = () => {
  const card = CARDS[state.current];
  speak(`${card.word}. ${card.example}`);
};

$("#againBtn").onclick = () => mark("again");
$("#knowBtn").onclick = () => mark("know");

document.addEventListener("keydown", event => {
  const activeTag = document.activeElement && document.activeElement.tagName;
  if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;

  if (event.key === "ArrowUp") {
    event.preventDefault();
    const card = CARDS[state.current];
    speak(`${card.word}. ${card.example}`);
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    state.flipped = !state.flipped;
    render();
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    mark("again");
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    mark("know");
  }
});

render();
