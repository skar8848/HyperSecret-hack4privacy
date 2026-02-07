import './ProfileCard.css';

export default function ProfileCard({
  avatarUrl,
  contactText = 'Contact',
  onContactClick
}) {
  return (
    <div className="pcard-wrapper">
      <div className="pcard">
        <div className="pcard-avatar">
          <img
            className="pcard-avatar-img"
            src={avatarUrl}
            alt="Team member"
            loading="lazy"
          />
        </div>
        <button
          className="pcard-contact-btn"
          onClick={onContactClick}
          type="button"
        >
          {contactText}
        </button>
      </div>
    </div>
  );
}
