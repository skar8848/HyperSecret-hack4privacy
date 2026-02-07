import ProfileCard from "./ProfileCard";
import "./TeamPage.css";

import pfpLeft from "../assets png/pfp card left.jpeg";
import pfpRight from "../assets png/pfp card right.png";

export default function TeamPage() {
  return (
    <div className="team-page">
      <div className="team-hero">
        <h1 className="team-title">MEET THE TEAM</h1>
      </div>

      <div className="team-grid">
        <ProfileCard
          avatarUrl={pfpLeft}
          onContactClick={() => window.open("#", "_blank")}
        />
        <ProfileCard
          avatarUrl={pfpRight}
          onContactClick={() => window.open("#", "_blank")}
        />
      </div>
    </div>
  );
}
