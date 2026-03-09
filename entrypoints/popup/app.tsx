import { createSignal, For, Show } from "solid-js";
import "./app.css";

interface Result {
  title: string;
  url: string;
  type: "bookmark" | "history" | "tab";
  tabId?: number;
  windowId?: number;
}

async function activateResult(result: Result) {
  if (result.type === "tab" && result.tabId != null) {
    await browser.tabs.update(result.tabId, { active: true });
    await browser.windows.update(result.windowId!, { focused: true });
  } else {
    await browser.tabs.create({ url: result.url });
  }
  window.close();
}

async function search(query: string): Promise<Result[]> {
  const q = query.toLowerCase();

  const [bookmarks, history, allTabs] = await Promise.all([
    browser.bookmarks.search(query),
    browser.history.search({ text: query, maxResults: 50 }),
    browser.tabs.query({}),
  ]);

  const seenUrls = new Set<string>();
  const results: Result[] = [];

  const tabs = allTabs.filter(
    (t) => t.url && (t.title?.toLowerCase().includes(q) || t.url.toLowerCase().includes(q))
  );

  for (const t of tabs) {
    if (t.url) {
      seenUrls.add(t.url);
      results.push({ title: t.title || t.url, url: t.url, type: "tab", tabId: t.id, windowId: t.windowId });
    }
  }

  for (const b of bookmarks) {
    if (b.url && !seenUrls.has(b.url)) {
      seenUrls.add(b.url);
      results.push({ title: b.title || b.url, url: b.url, type: "bookmark" });
    }
  }

  for (const h of history) {
    if (h.url && !seenUrls.has(h.url)) {
      results.push({ title: h.title || h.url, url: h.url, type: "history" });
    }
  }

  return results;
}

function App() {
  const [query, setQuery] = createSignal("");
  const [results, setResults] = createSignal<Result[]>([]);
  let debounce: ReturnType<typeof setTimeout>;

  const handleInput = (value: string) => {
    setQuery(value);
    clearTimeout(debounce);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    debounce = setTimeout(async () => {
      setResults(await search(value.trim()));
    }, 150);
  };

  return (
    <div class="container">
      <div class="search-bar">
        <input
          type="text"
          placeholder="Search bookmarks and history..."
          value={query()}
          onInput={(e) => handleInput(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results().length > 0) activateResult(results()[0]);
          }}
          autofocus
        />
      </div>
      <div class="results">
        <Show when={query().trim().length > 0 && results().length === 0}>
          <p class="empty">No results for "{query()}"</p>
        </Show>
        <For each={results()}>
          {(result) => (
            <a
              class="result-item"
              href={result.url}
              onClick={async (e) => {
                e.preventDefault();
                await activateResult(result);
              }}
            >
              <div class="result-header">
                <span class="result-title">{result.title}</span>
                <span class={`result-badge ${result.type}`}>{result.type}</span>
              </div>
              <span class="result-url">{result.url}</span>
            </a>
          )}
        </For>
      </div>
    </div>
  );
}

export default App;
