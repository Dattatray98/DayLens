import { Link } from "react-router-dom";
import appIcon from "../../assets/icon.png";

const features = [
  { mark: "₹", title: "Money", copy: "Keep income, spending, and your balance in one clear view." },
  { mark: "+", title: "Diet", copy: "Log meals and follow the nutrition details that matter to you." },
  { mark: "⌁", title: "Wellness", copy: "Track personal metrics and see how they change over time." },
  { mark: "✎", title: "Notes", copy: "Save useful thoughts and find them again when you need them." },
  { mark: "↗", title: "Reports", copy: "Review summaries built from the records you have entered." },
  { mark: "⌂", title: "Overview", copy: "Start with a calm snapshot of your day and recent activity." },
];

export default function LandingPage() {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <a className="landing-brand" href="#top" aria-label="Daylens home">
          <img src={appIcon} alt="" />
          <span>Daylens</span>
        </a>
        <nav className="landing-links" aria-label="Page navigation">
          <a href="#features">What’s inside</a>
          <a href="#how-it-works">How it works</a>
          <a href="#privacy">Your data</a>
        </nav>
        <div className="landing-header-actions">
          <Link className="landing-signin" to="/login">Sign in</Link>
          <Link className="landing-button landing-button-small" to="/register">Get started</Link>
        </div>
      </header>

      <main>
        <section id="top" className="landing-hero landing-shell">
          <div className="landing-hero-copy">
            <span className="landing-kicker"><i /> Your personal workspace</span>
            <h1>See your life<br />more clearly.</h1>
            <p>Bring money, nutrition, wellness, notes, and insights into one calm place, so it’s easier to notice what matters to you.</p>
            <div className="landing-actions">
              <Link className="landing-button" to="/register">Create your workspace <span aria-hidden="true">↗</span></Link>
              <Link className="landing-secondary" to="/login">I already have an account</Link>
            </div>
            <p className="landing-local-note"><span /> Your records stay on this device.</p>
          </div>

          <div className="landing-preview" aria-label="Illustration of a Daylens overview">
            <div className="landing-preview-top">
              <div className="landing-preview-brand"><img src={appIcon} alt="" /><strong>Daylens</strong></div>
              <span>Today</span>
            </div>
            <div className="landing-preview-title">
              <div><small>YOUR DAY</small><h2>A little more in focus.</h2></div>
              <span className="landing-sun" aria-hidden="true">◒</span>
            </div>
            <div className="landing-preview-grid">
              <article className="landing-preview-card landing-money-preview">
                <div className="landing-card-heading"><span className="landing-preview-mark">₹</span><span>Money</span></div>
                <strong>In good balance</strong>
                <div className="landing-bars" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
                <small>Income and spending</small>
              </article>
              <article className="landing-preview-card landing-diet-preview">
                <div className="landing-card-heading"><span className="landing-preview-mark">+</span><span>Diet</span></div>
                <strong>Daily nutrition</strong>
                <div className="landing-progress"><i /></div>
                <small>A clearer view of your meals</small>
              </article>
            </div>
            <div className="landing-note-preview"><span className="landing-preview-mark">✎</span><span><strong>Notes</strong><small>Keep a thought close</small></span><span className="landing-note-arrow">↗</span></div>
            <div className="landing-preview-foot"><i /> Saved on this device</div>
          </div>
          <span className="landing-orbit landing-orbit-one" aria-hidden="true" />
          <span className="landing-orbit landing-orbit-two" aria-hidden="true" />
        </section>

        <section id="features" className="landing-section landing-shell">
          <div className="landing-section-heading">
            <span className="landing-kicker">A place for the everyday</span>
            <h2>One view of what matters to you.</h2>
            <p>Small details add up. Daylens gives them room to make sense.</p>
          </div>
          <div className="landing-feature-grid">
            {features.map((feature) => (
              <article className="landing-feature" key={feature.title}>
                <span className="landing-feature-mark" aria-hidden="true">{feature.mark}</span>
                <h3>{feature.title}</h3>
                <p>{feature.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="landing-how-section">
          <div className="landing-shell">
            <div className="landing-section-heading">
              <span className="landing-kicker">Simple by design</span>
              <h2>Your day, in a few small steps.</h2>
              <p>Keep the things you already track together and easy to revisit.</p>
            </div>
            <div className="landing-steps">
              <article><span>01</span><h3>Add what happened</h3><p>Log a transaction, meal, wellness metric, or note in its own space.</p></article>
              <article><span>02</span><h3>Keep it together</h3><p>Your records are saved locally on the device you use.</p></article>
              <article><span>03</span><h3>See what adds up</h3><p>Overview and Reports summarize the information you have entered.</p></article>
            </div>
          </div>
        </section>

        <section className="landing-assistant landing-shell" aria-labelledby="landing-assistant-heading">
          <div className="landing-assistant-copy">
            <span className="landing-kicker"><i /> AI assistant · coming soon</span>
            <h2 id="landing-assistant-heading">A simpler way to log wellness.</h2>
            <p>We’re working on an assistant that can understand everyday requests for supported wellness actions. Daylens will handle calculations and save records locally.</p>
            <p className="landing-assistant-note">This feature is in development and isn’t available in the app yet.</p>
          </div>
          <div className="landing-assistant-preview" aria-label="Concept preview of the upcoming assistant">
            <div className="landing-assistant-head"><img src={appIcon} alt="" /><span><strong>Assistant preview</strong><small>Concept · not available yet</small></span><i /></div>
            <div className="landing-chat landing-chat-user">I ate 50 g of soya</div>
            <div className="landing-chat landing-chat-reply"><b>D</b><span>A planned example of a food log request.</span></div>
            <div className="landing-assistant-foot"><i /> Preview only · the assistant isn’t in the app yet</div>
          </div>
        </section>

        <section id="privacy" className="landing-privacy">
          <div className="landing-shell landing-privacy-inner">
            <span className="landing-privacy-mark" aria-hidden="true">⌂</span>
            <div><span className="landing-kicker">Personal by design</span><h2>Your life belongs to you.</h2><p>Daylens keeps its workspace on your device. There’s no cloud sync or server account recovery, so your browser or app data stays under your control.</p></div>
            <div className="landing-storage"><i /><span>Stored locally<strong>On this device</strong></span></div>
          </div>
        </section>

        <section className="landing-final landing-shell">
          <span className="landing-kicker">Make space for a clearer day</span>
          <h2>Start with what matters today.</h2>
          <p>Bring your everyday records together in Daylens.</p>
          <Link className="landing-button" to="/register">Create your workspace <span aria-hidden="true">↗</span></Link>
        </section>
      </main>

      <footer className="landing-footer"><div className="landing-shell"><a className="landing-brand" href="#top"><img src={appIcon} alt="" /><span>Daylens</span></a><span>See your life more clearly.</span><Link to="/login">Sign in</Link></div></footer>
    </div>
  );
}
