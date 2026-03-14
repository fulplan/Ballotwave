export type UssdLang = "en" | "tw" | "ha";

const strings: Record<UssdLang, Record<string, string>> = {
  en: {
    welcome: "Welcome to BallotWave\n1. English\n2. Twi\n3. Hausa",
    enter_phone: "Enter your registered phone number:",
    enter_pin: "Enter your 4-digit PIN:",
    invalid_pin: "Invalid PIN. {remaining} attempts remaining.",
    account_locked: "Account locked due to too many failed attempts. Try again after 1 hour.",
    phone_not_found: "Phone number not registered. Contact your school admin.",
    no_active_elections: "No active elections at this time.",
    select_election: "Active Elections:\n{list}\n\n0. Back\n#. Exit",
    select_position: "Positions in {election}:\n{list}\n\n0. Back\n#. Exit",
    select_candidate: "Candidates for {position}:\n{list}\n\n0. Back\n#. Exit",
    confirm_vote: "You are voting for:\n{candidate}\nfor {position}\n\n1. Confirm\n0. Back\n#. Cancel",
    vote_success: "Vote cast successfully!\nReceipt: {receipt}\nThank you for voting.",
    vote_failed: "Failed to cast vote: {reason}",
    already_voted: "You have already voted in this election.",
    election_not_active: "This election is not currently active.",
    invalid_input: "Invalid input. Please try again.",
    session_expired: "Session expired. Please dial again.",
    goodbye: "Thank you for using BallotWave. Goodbye!",
    main_menu: "Main Menu:\n1. Vote in an election\n0. Change language\n#. Exit",
  },
  tw: {
    welcome: "Akwaaba BallotWave\n1. English\n2. Twi\n3. Hausa",
    enter_phone: "Hyɛ wo phone nɔma a wɔde aregista no:",
    enter_pin: "Hyɛ wo PIN nɔma 4 no:",
    invalid_pin: "PIN no nyɛ papa. {remaining} nhwɛ nkɔ ka.",
    account_locked: "Wɔato wo mu efisɛ woahwɛ PIN mpɛn pii. Hwɛ bio bere 1 akyi.",
    phone_not_found: "Phone nɔma no nni hɔ. Ka kyerɛ wo school admin.",
    no_active_elections: "Abatoɔ biara nni hɔ seisei.",
    select_election: "Abatoɔ a ɛrekɔ so:\n{list}\n\n0. San\n#. Gyae",
    select_position: "Dibea wɔ {election} mu:\n{list}\n\n0. San\n#. Exit",
    select_candidate: "Akannifoɔ a wɔdi {position}:\n{list}\n\n0. San\n#. Gyae",
    confirm_vote: "Woto aba ama:\n{candidate}\nwɔ {position}\n\n1. Gye tom\n0. San\n#. Twa mu",
    vote_success: "Wo aba no akɔ!\nReceipt: {receipt}\nYɛda wo ase.",
    vote_failed: "Aba to no ansi yie: {reason}",
    already_voted: "Woato aba dada wɔ abatoɔ yi mu.",
    election_not_active: "Abatoɔ yi nkɔ so seisei.",
    invalid_input: "Nea wohyɛɛ no nyɛ papa. Hwɛ bio.",
    session_expired: "Bere no atwam. Frɛ bio.",
    goodbye: "Yɛda wo ase sɛ wode BallotWave ayɛ adwuma. Nante yie!",
    main_menu: "Menu Kɛseɛ:\n1. To aba wɔ abatoɔ mu\n0. Sesa kasa\n#. Gyae",
  },
  ha: {
    welcome: "Barka da zuwa BallotWave\n1. English\n2. Twi\n3. Hausa",
    enter_phone: "Shigar da lambar wayar ku:",
    enter_pin: "Shigar da PIN ɗin ku mai lamba 4:",
    invalid_pin: "PIN ba daidai ba ne. Kuna da {remaining} ƙoƙari.",
    account_locked: "An kulle asusun ku saboda yawan ƙoƙarin da bai yi nasara ba. A sake gwadawa bayan awa 1.",
    phone_not_found: "Ba a yin rajista da wannan lambar waya ba.",
    no_active_elections: "Babu zaɓe da ke gudana a yanzu.",
    select_election: "Zaɓen da ke gudana:\n{list}\n\n0. Komawa\n#. Fita",
    select_position: "Muƙamai a {election}:\n{list}\n\n0. Komawa\n#. Fita",
    select_candidate: "Yan takara na {position}:\n{list}\n\n0. Komawa\n#. Fita",
    confirm_vote: "Kuna zaɓar:\n{candidate}\ndon {position}\n\n1. Tabbatar\n0. Komawa\n#. Soke",
    vote_success: "An jefa ƙuri'ar ku!\nReceipt: {receipt}\nNa gode.",
    vote_failed: "An kasa jefa ƙuri'a: {reason}",
    already_voted: "Kun riga kun jefa ƙuri'a a wannan zaɓen.",
    election_not_active: "Wannan zaɓen bai fara ba tukuna.",
    invalid_input: "Shigarwar ba daidai ba. A sake gwadawa.",
    session_expired: "Lokaci ya ƙare. A sake kira.",
    goodbye: "Na gode da amfani da BallotWave. Sai an jima!",
    main_menu: "Babban Menu:\n1. Jefa ƙuri'a\n0. Canza harshe\n#. Fita",
  },
};

export function t(lang: UssdLang, key: string, vars?: Record<string, string>): string {
  let str = strings[lang]?.[key] || strings.en[key] || key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(`{${k}}`, v);
    }
  }
  return str;
}

export function isValidLang(code: string): code is UssdLang {
  return code === "en" || code === "tw" || code === "ha";
}
