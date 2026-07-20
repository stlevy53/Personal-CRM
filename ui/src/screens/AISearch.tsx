import { Icon } from "../app/icons";

const EXAMPLES = [
  "What did I commit to in my last conversation with Acme Corp?",
  "Which companies haven't I followed up with in the last 30 days?",
  "Summarize the open action items across all my interviews.",
  "What's the status of my conversation with Globex Inc?",
];

export function AISearch() {
  return (
    <section>
      <div className="ai-wrap">
        <div className="ai-hero">
          <div className="ai-spark">
            <Icon name="ai" />
          </div>
          <h2>Ask the relationship record</h2>
          <p>
            Natural-language answers synthesized from every logged interaction, note, and
            commitment — with citations back to the source.
          </p>
          <div className="ai-soon-pill">
            <Icon name="clock" />
            Coming soon
          </div>
        </div>

        <div className="ai-suggestions">
          {EXAMPLES.map((q) => (
            <div className="ai-sug" key={q}>
              <Icon name="search" />
              {q}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
