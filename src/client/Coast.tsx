export function Coast({ compact = false }: { compact?: boolean }) {
  return <svg className={`coast ${compact ? 'compact' : ''}`} viewBox="0 0 720 520" preserveAspectRatio="xMidYMid slice" role="img" aria-label="A warm lighthouse beam reaches across a dark blue sea toward a small sailboat.">
    <defs>
      <linearGradient id="sky" x2="0" y2="1"><stop stopColor="#142c3a"/><stop offset="1" stopColor="#264650"/></linearGradient>
      <linearGradient id="beam"><stop stopColor="#efc77b" stopOpacity=".48"/><stop offset="1" stopColor="#efc77b" stopOpacity=".02"/></linearGradient>
      <clipPath id="scene"><rect width="720" height="520" rx="12"/></clipPath>
    </defs>
    <g clipPath="url(#scene)">
      <path fill="url(#sky)" d="M0 0h720v520H0z"/>
      <g fill="#b5c7c3" opacity=".5"><circle cx="134" cy="80" r="2"/><circle cx="465" cy="64" r="2"/><circle cx="619" cy="118" r="2"/><circle cx="350" cy="115" r="1.5"/><path d="m547 43 2 7 7 2-7 2-2 7-2-7-7-2 7-2z"/></g>
      <circle cx="605" cy="74" r="28" fill="#d0d4b4"/><circle cx="616" cy="65" r="28" fill="#1b3441"/>
      <path d="M-20 159h170l-24-16H76l-23-15H-20M406 182h192l-32-19h-84l-26-18h-50" fill="#304b56"/>
      <path d="m226 188 494-106v209Z" fill="url(#beam)"/>
      <path d="M0 305q70-20 139 0t142 0 142 0 145 0 152 0v215H0" fill="#24505b"/>
      <path d="M0 350q70-20 139 0t142 0 142 0 145 0 152 0v170H0" fill="#1d414e"/>
      <path d="M0 407q70-20 139 0t142 0 142 0 145 0 152 0v113H0" fill="#15333f"/>
      <g stroke="#769b9b" strokeWidth="2" strokeLinecap="round" opacity=".45"><path d="M360 333h58m101 24h53m53-35h42M312 389h32m123 29h72m62-36h24M244 460h69m275 20h42m-181-16h40"/></g>
      <path d="m0 407 61-31 60-71 45-14 73 39 42 67 87 123H0Z" fill="#152b31"/>
      <path d="m0 431 88-44 62-38 70 11 54 70 57 90H0" fill="#29443e"/>
      <path d="m142 352 22-145h62l21 145Z" fill="#eee0b7"/>
      <path d="m153 278 4-27h75l4 27zm-9 58 4-28h92l4 28z" fill="#c37d5d"/>
      <path d="m195 207 3 145h49l-21-145Z" fill="#c6bd9c" opacity=".55"/>
      <path d="M157 207v-37h76v37Z" fill="#142c37"/>
      <path d="M168 180h54v19h-54Z" fill="#f1cc7e"/><path d="M185 178v23m18-23v23" stroke="#45504b" strokeWidth="4"/>
      <path d="m150 170 45-30 45 30Z" fill="#cf8e68"/><path d="M195 141v-22" stroke="#c8b797" strokeWidth="3"/>
      <path d="M146 211h98" stroke="#d4c7a5" strokeWidth="5"/>
      <path d="M184 352v-26a11 11 0 0 1 22 0v26" fill="#263c40"/>
      <path d="M204 256h8v15h-8" fill="#273c42"/>
      <path d="m489 312 19 15h53l15-15Z" fill="#e1ba79"/><path d="M533 239v73" stroke="#ded3ae" strokeWidth="3"/><path d="m526 248-34 56h34Z" fill="#ded5b6"/><path d="m540 263 23 41h-23Z" fill="#a9b7a6"/>
      <g fill="#51756d"><path d="m72 401 12-42 7 37 11-21 4 31Z"/><path d="m271 458 6-39 12 31 14-15-6 28Z"/></g>
      <path d="M45 474q58-17 117 0m201-201 9-5 10 5 10-5 10 5" fill="none" stroke="#8eaaa1" strokeWidth="2" opacity=".55"/>
    </g>
  </svg>;
}
