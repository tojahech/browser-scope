import { createSignal, For, Show } from "solid-js";
import "./app.css";

interface Result {
  id: number;
  title: string;
  url: string;
  description: string;
}

const MOCK_RESULTS: Result[] = [
  { id: 1, title: "SolidJS", url: "https://solidjs.com", description: "Simple and performant reactivity for building user interfaces." },
  { id: 2, title: "WXT", url: "https://wxt.dev", description: "Next-gen web extension framework." },
  { id: 3, title: "MDN Web Docs", url: "https://developer.mozilla.org", description: "Resources for developers, by developers." },
];

function App() {
  const [query, setQuery] = createSignal("");

  const results = () => {
    const q = query().toLowerCase().trim();
    if (!q) return [];
    return MOCK_RESULTS.filter(
      (r) => r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)
    );
  };

  return (
    <div class="container">
      <div class="search-bar">
        <input
          type="text"
          placeholder="Search..."
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
          autofocus
        />
      </div>
      <div class="results">
        <Show when={query().trim().length > 0 && results().length === 0}>
          <p class="empty">No results for "{query()}"</p>
        </Show>
        <For each={results()}>
          {(result) => (
            <a class="result-item" href={result.url} target="_blank" rel="noopener">
              <span class="result-title">{result.title}</span>
              <span class="result-url">{result.url}</span>
              <span class="result-description">{result.description}</span>
            </a>
          )}
        </For>
      </div>
    </div>
  );
}

export default App;
