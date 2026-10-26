import React from "react";
import lightIcon from "../../../assets/icon.png";

interface LogoStartupScreenProps {
  theme: "light" | "dark";
  isExiting: boolean;
  onAnimationComplete: () => void;
  onExitComplete: () => void;
}

export const LogoStartupScreen: React.FC<LogoStartupScreenProps> = ({ theme, isExiting, onAnimationComplete, onExitComplete }) => (
  <div
    className={`daylens-startup daylens-startup-${theme}${isExiting ? " is-exiting" : ""}`}
    role="status"
    aria-label="Starting Daylens"
    aria-live="polite"
    onTransitionEnd={event => {
      if (isExiting && event.target === event.currentTarget && event.propertyName === "opacity") onExitComplete();
    }}
  >
    <div className="daylens-startup-glow" aria-hidden="true" />
    <div className="daylens-startup-brand">
      <img
        src={lightIcon}
        alt=""
        className="daylens-startup-logo"
      />
      <h1>Daylens</h1>
      <p className="daylens-startup-tagline">See your life more clearly.</p>
      <p
        className="daylens-startup-loading"
        onAnimationEnd={event => {
          if (event.target === event.currentTarget) onAnimationComplete();
        }}
      ><span aria-hidden="true" />Opening your local workspace…</p>
    </div>
  </div>
);

export default LogoStartupScreen;
