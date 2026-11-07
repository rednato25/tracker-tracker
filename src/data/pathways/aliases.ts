// src/data/pathways/aliases.ts
//
// Explicit trackerpathways name -> registry slug map. The dataset spells
// several trackers differently from the registry ("YuScene", "OnlyEncodes+",
// "MyAnonamouse"), and a few names differ by punctuation only. Matching by
// normalised name guessed most of these but could not say which spelling was
// canonical, so every name that identifies a production registry tracker is
// listed here by hand. Adding a registry tracker or refreshing the snapshot
// must update this map or the coverage test fails.

export const PATHWAYS_TRACKER_ALIASES: Readonly<Record<string, string>> = {
  Aither: "aither",
  AlphaRatio: "alpharatio",
  AnimeBytes: "animebytes",
  AnimeZ: "animez",
  Anthelion: "anthelion",
  AvistaZ: "avistaz",
  Blutopia: "blutopia",
  BroadcasTheNet: "broadcasthenet",
  "Cathode-Ray.Tube": "cathoderaytube",
  CinemaZ: "cinemaz",
  Concertos: "concertos",
  DarkPeers: "darkpeers",
  DigitalCore: "digitalcore",
  "DigitalCore.Club": "digitalcore",
  Empornium: "empornium",
  ExoticaZ: "exoticaz",
  FileList: "filelist",
  GazelleGames: "gazellegames",
  "Great Poster Wall": "greatposterwall",
  "Hawke-uno": "hawkeuno",
  InfinityHD: "infinityhd",
  IPTorrents: "iptorrents",
  LST: "lst",
  Luminarr: "luminarr",
  "M-Team": "mteam",
  MyAnonamouse: "myanonamouse",
  Nebulance: "nebulance",
  OldToonsWorld: "oldtoons",
  "OnlyEncodes+": "onlyencodes",
  Orpheus: "orpheus",
  PassThePopcorn: "passthepopcorn",
  "Phoenix Project": "phoenixproject",
  Portugas: "portugas",
  PrivateHD: "privatehd",
  Racing4Everyone: "racing4everyone",
  Redacted: "redacted",
  ReelFliX: "reelflix",
  RetroFlix: "retroflix",
  RetroMoviesClub: "retromoviesclub",
  RetroToon: "retrotoon",
  RocketHD: "rockethd",
  seedpool: "seedpool",
  SkipTheCommercials: "skipthecommercials",
  SpeedApp: "speedapp",
  TorrentLeech: "torrentleech",
  "Upload.cx": "uploadcx",
  YuScene: "yuscene",
  Zenith: "zenith",
}

/**
 * Production registry trackers with no name in the pinned trackerpathways
 * snapshot. They cannot become an owned card until upstream adds them; the
 * coverage test fails if a tracker is missing without being listed here.
 */
export const PATHWAYS_UNMATCHED_REGISTRY_SLUGS: readonly string[] = [
  "c411",
  "carpt",
  "dreadvault",
  "fearnopeer",
  "morethantv",
  "seedcore",
  "tr4ker",
  "v3x",
]
