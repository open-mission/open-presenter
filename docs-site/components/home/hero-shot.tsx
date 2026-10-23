export function HeroShot() {
  return (
    <div className="hero-shot-wrap">
      <div className="hero-shot-glow" aria-hidden="true" />
      <div className="hero-shot">
        <div className="hero-shot-bar">
          <span className="hero-shot-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="hero-shot-title">Open Presenter — Painel do operador</span>
          <span className="hero-shot-live">
            <span className="hero-shot-pulse" aria-hidden="true" />
            ao vivo
          </span>
        </div>
        <img
          src="/screenshots/main.webp"
          alt="Painel do Open Presenter com programação do culto, letras, prévia e monitores de saída"
          width={1680}
          height={927}
          loading="eager"
          fetchPriority="high"
        />
      </div>

      <div className="float-chip float-chip-left">
        <span className="float-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="4" width="18" height="14" rx="2" />
            <path d="M8 21h8M12 18v3" />
          </svg>
        </span>
        <span>
          <strong>Prévia → Ao vivo</strong>
          <small>um clique decide</small>
        </span>
      </div>

      <div className="float-chip float-chip-right">
        <span className="float-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 5v14M20 5v14M4 12h16" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </span>
        <span>
          <strong>Stage sincronizado</strong>
          <small>mesmo frame, outra tela</small>
        </span>
      </div>

      <div className="float-chip float-chip-bottom">
        <span className="float-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
            <path d="M11 18.5h2" />
          </svg>
        </span>
        <span>
          <strong>Controle remoto</strong>
          <small>sem instalar app</small>
        </span>
      </div>
    </div>
  );
}
