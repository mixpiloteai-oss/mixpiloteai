/**
 * UserGuideData — Static guide content for Neurotek DAW.
 * Each section maps to a major feature area of the application.
 */

export interface GuideStep {
  action: string
  shortcut?: string
  description: string
}

export interface GuideSection {
  id: string
  title: string
  icon: string
  steps: GuideStep[]
}

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'new-project',
    title: 'Créer un projet',
    icon: '🗂',
    steps: [
      {
        action: 'Nouveau projet',
        shortcut: 'Ctrl+N',
        description: 'Réinitialise toutes les pistes et clips. Choisir le BPM et la signature rythmique au démarrage.',
      },
      {
        action: 'Choisir le BPM',
        description: 'Clic sur la valeur BPM dans la barre transport, puis saisir la valeur souhaitée ou utiliser les boutons +/-.',
      },
      {
        action: 'Changer la signature',
        description: 'Clic sur les chiffres 4/4 dans la barre transport pour modifier la signature rythmique.',
      },
      {
        action: 'Sauvegarder',
        shortcut: 'Ctrl+S',
        description: 'Sauvegarde manuelle du projet. Une sauvegarde automatique est également effectuée toutes les 60 secondes.',
      },
    ],
  },
  {
    id: 'import-audio',
    title: 'Importer des samples audio',
    icon: '🎵',
    steps: [
      {
        action: 'Ouvrir le Browser',
        shortcut: 'Ctrl+B',
        description: 'Afficher la vue Browser dans la sidebar pour parcourir vos fichiers audio.',
      },
      {
        action: 'Chercher un sample',
        description: 'Saisir un terme dans la barre de recherche du Browser pour filtrer les fichiers audio.',
      },
      {
        action: 'Prévisualiser',
        description: 'Clic sur un sample dans le Browser pour l\'écouter avant de l\'importer.',
      },
      {
        action: 'Importer',
        description: 'Glisser le sample depuis le Browser vers la timeline, ou double-clic pour l\'ajouter automatiquement.',
      },
      {
        action: 'Formats supportés',
        description: 'WAV, MP3, OGG, FLAC, AIFF — tous les formats audio courants sont acceptés.',
      },
    ],
  },
  {
    id: 'add-track',
    title: 'Ajouter des pistes',
    icon: '➕',
    steps: [
      {
        action: 'Piste Audio',
        description: 'Clic droit sur la timeline > Insert Audio Track, ou via le menu Fichier pour ajouter une piste audio.',
      },
      {
        action: 'Piste MIDI',
        description: 'Clic droit sur la timeline > Insert MIDI Track pour ajouter une piste MIDI.',
      },
      {
        action: 'Renommer',
        description: 'Double-clic sur le nom de la piste, ou clic droit > Rename pour personnaliser le nom.',
      },
      {
        action: 'Couleur',
        description: 'Clic droit sur la piste > Set Color pour attribuer une couleur personnalisée.',
      },
      {
        action: 'Supprimer',
        description: 'Clic droit sur la piste > Delete Track pour supprimer définitivement la piste.',
      },
    ],
  },
  {
    id: 'piano-roll',
    title: 'Piano Roll et notes MIDI',
    icon: '🎹',
    steps: [
      {
        action: 'Ouvrir le Piano Roll',
        shortcut: 'Ctrl+3',
        description: 'Double-clic sur un clip MIDI dans la timeline pour ouvrir le Piano Roll.',
      },
      {
        action: 'Dessiner une note',
        shortcut: 'F2',
        description: 'Activer l\'outil Crayon (F2), puis cliquer sur la grille pour créer une note MIDI.',
      },
      {
        action: 'Effacer une note',
        shortcut: 'F3',
        description: 'Activer l\'outil Gomme (F3), puis cliquer sur la note à supprimer.',
      },
      {
        action: 'Sélectionner',
        shortcut: 'F1',
        description: 'Activer l\'outil Pointeur (F1), puis cliquer ou glisser pour sélectionner des notes.',
      },
      {
        action: 'Modifier la durée',
        description: 'Glisser le bord droit d\'une note pour allonger ou raccourcir sa durée.',
      },
      {
        action: 'Modifier la vélocité',
        description: 'Utiliser le panneau Velocity en bas du Piano Roll pour ajuster l\'intensité de chaque note.',
      },
      {
        action: 'Gamme musicale',
        description: 'Activer Scale Lock pour contraindre la saisie aux notes de la gamme sélectionnée.',
      },
      {
        action: 'Snap',
        description: 'Choisir la résolution de grille (1/16, 1/8, 1/4…) dans la toolbar du Piano Roll.',
      },
    ],
  },
  {
    id: 'transport',
    title: 'Transport et lecture',
    icon: '▶',
    steps: [
      {
        action: 'Play / Pause',
        shortcut: 'Espace',
        description: 'Démarrer ou mettre en pause la lecture du projet.',
      },
      {
        action: 'Stop',
        shortcut: 'Escape',
        description: 'Arrêter la lecture et retourner au début du projet.',
      },
      {
        action: 'Enregistrer',
        shortcut: 'Ctrl+R',
        description: 'Armer l\'enregistrement et démarrer la capture audio ou MIDI avec le transport.',
      },
      {
        action: 'Loop',
        shortcut: 'Ctrl+L',
        description: 'Activer ou désactiver la lecture en boucle sur la région sélectionnée.',
      },
      {
        action: 'Définir la boucle',
        description: 'Glisser les marqueurs L/R sur la règle de temps pour définir la région de boucle.',
      },
      {
        action: 'Déplacer la tête de lecture',
        description: 'Clic sur la règle de temps pour positionner la tête de lecture à l\'endroit souhaité.',
      },
      {
        action: 'Ajuster le BPM',
        shortcut: 'Ctrl+↑/↓',
        description: 'Clic direct sur la valeur BPM dans la barre transport, ou utiliser Ctrl+Haut/Bas.',
      },
    ],
  },
  {
    id: 'mixer',
    title: 'Mixer et routing',
    icon: '🎚',
    steps: [
      {
        action: 'Ouvrir le Mixer',
        shortcut: 'Ctrl+2',
        description: 'Ouvrir la vue Mixer via le raccourci ou l\'icône dans la sidebar.',
      },
      {
        action: 'Volume',
        description: 'Glisser le fader vertical de chaque piste pour ajuster son volume.',
      },
      {
        action: 'Pan',
        description: 'Ajuster le curseur horizontal de panoramique. Double-clic pour reset à 0 (centre).',
      },
      {
        action: 'Mute / Solo',
        description: 'Utiliser les boutons M (Mute) et S (Solo) sur chaque piste pour isoler ou couper le son.',
      },
      {
        action: 'Chaîne FX',
        description: 'Clic sur le bouton "FX" d\'une piste pour ouvrir et éditer sa chaîne d\'effets.',
      },
      {
        action: 'Sends',
        description: 'Configurer le routage vers des bus auxiliaires pour partager des effets entre plusieurs pistes.',
      },
      {
        action: 'Master',
        description: 'Un limiteur est présent sur la piste Master pour éviter la saturation lors de l\'export.',
      },
    ],
  },
  {
    id: 'effects',
    title: 'Effets et plugins',
    icon: '🔊',
    steps: [
      {
        action: 'Ajouter un effet',
        description: 'Ouvrir la chaîne FX d\'une piste, puis clic droit > Add Effect pour ajouter un nouveau traitement.',
      },
      {
        action: 'Effets disponibles',
        description: 'Reverb, Delay, Compressor, EQ, Distortion, Chorus, Filter — tous inclus dans Neurotek.',
      },
      {
        action: 'Bypass',
        description: 'Cliquer sur le bouton on/off de chaque effet pour le désactiver temporairement sans le supprimer.',
      },
      {
        action: 'Réordonner',
        description: 'Glisser les effets dans la chaîne pour modifier leur ordre de traitement du signal.',
      },
      {
        action: 'VST',
        description: 'Utiliser le panneau VST dans la sidebar pour charger et gérer des plugins externes.',
      },
      {
        action: 'Automation',
        description: 'Clic droit sur un paramètre d\'effet > Create Automation Lane pour automatiser sa valeur.',
      },
    ],
  },
  {
    id: 'automation',
    title: 'Automation',
    icon: '📈',
    steps: [
      {
        action: 'Créer une lane',
        description: 'Clic sur le triangle ▶ à gauche d\'une piste pour déployer ses lanes d\'automation.',
      },
      {
        action: 'Dessiner',
        description: 'Activer l\'outil Crayon dans la vue Automation et cliquer/glisser pour dessiner des points.',
      },
      {
        action: 'Types de courbe',
        description: 'Clic droit sur un segment pour choisir le type : linéaire, exponentielle ou step.',
      },
      {
        action: 'Modes',
        description: 'Read (lecture seule), Write (enregistrement temps réel), Touch (écrase au toucher), Latch (maintient).',
      },
      {
        action: 'Supprimer un point',
        description: 'Activer l\'outil Gomme et cliquer sur un point d\'automation pour le supprimer.',
      },
    ],
  },
  {
    id: 'export',
    title: 'Export audio',
    icon: '📤',
    steps: [
      {
        action: 'Ouvrir le panneau Export',
        description: 'Accéder au panneau Export depuis la sidebar pour configurer les paramètres d\'export.',
      },
      {
        action: 'Format',
        description: 'Choisir WAV (non compressé, qualité maximale), MP3 ou OGG selon l\'usage final.',
      },
      {
        action: 'Résolution',
        description: '16 ou 24 bits — 24 bits recommandé pour la production et le mastering professionnel.',
      },
      {
        action: 'Stems',
        description: 'Activer l\'option "Stems" pour exporter chaque piste séparément en fichiers individuels.',
      },
      {
        action: 'Normalisation',
        description: 'Cocher "Normalize" pour maximiser automatiquement le volume sans écrêtage.',
      },
      {
        action: 'Région',
        description: 'Choisir d\'exporter tout le projet ou uniquement la région définie par les marqueurs de boucle.',
      },
    ],
  },
  {
    id: 'recording',
    title: 'Enregistrement audio',
    icon: '🔴',
    steps: [
      {
        action: 'Armer une piste',
        shortcut: 'Alt+R',
        description: 'Cliquer sur le bouton REC (rouge) sur la piste souhaitée pour l\'armer à l\'enregistrement.',
      },
      {
        action: 'Monitoring',
        description: 'Activer Input Monitoring sur la piste pour entendre le signal d\'entrée en direct pendant l\'enregistrement.',
      },
      {
        action: 'Lancer l\'enregistrement',
        shortcut: 'Ctrl+R',
        description: 'Démarrer le transport en mode enregistrement pour capturer le signal audio ou MIDI.',
      },
      {
        action: 'Loop Recording',
        description: 'Activer le mode Loop Recording pour capturer plusieurs prises successives sur la même région.',
      },
      {
        action: 'Takes',
        description: 'Chaque enregistrement crée une "take" indépendante, sélectionnable dans le clip.',
      },
      {
        action: 'Latence',
        description: 'Si un délai perceptible est présent, ajuster la taille du buffer dans Préférences > Audio.',
      },
    ],
  },
  {
    id: 'shortcuts',
    title: 'Raccourcis clavier essentiels',
    icon: '⌨',
    steps: [
      {
        action: 'Transport',
        description: 'Espace = Play/Pause, Escape = Stop, Ctrl+R = Record, Ctrl+L = Loop.',
      },
      {
        action: 'Édition',
        description: 'Ctrl+Z = Undo, Ctrl+Y = Redo, Ctrl+D = Dupliquer, Delete = Supprimer.',
      },
      {
        action: 'Vues',
        description: 'Ctrl+1 = Arrangement, Ctrl+2 = Mixer, Ctrl+3 = Piano Roll, Ctrl+B = Browser.',
      },
      {
        action: 'Outils',
        description: 'F1 = Sélection, F2 = Crayon, F3 = Gomme, F4 = Coupure, Tab = Outil suivant.',
      },
      {
        action: 'Navigation',
        description: 'Ctrl+= = Zoom avant, Ctrl+- = Zoom arrière, Home = Début, Ctrl+A = Tout sélectionner.',
      },
    ],
  },
  {
    id: 'workflow-techno',
    title: 'Workflow Acid / Techno / Tribe',
    icon: '⚡',
    steps: [
      {
        action: 'BPM recommandé',
        description: '130–145 BPM pour Techno, 145–165 pour Hardtek/Tribe, 125–135 pour Acid.',
      },
      {
        action: 'Structure de base',
        description: 'Kick sur chaque temps (piste 1), Bassline MIDI (piste 2), Synth acid (piste 3).',
      },
      {
        action: 'Pattern Kick',
        description: 'Dessiner 4 notes par mesure dans le Piano Roll, vélocité maximale pour un kick percutant.',
      },
      {
        action: 'Bassline Acid',
        description: 'Séquencer une ligne de basse en notes courtes avec vélocité élevée et glide (portamento).',
      },
      {
        action: 'Build-up',
        description: 'Automatiser le filtre (cutoff) sur les synths pour créer de la tension avant le drop.',
      },
      {
        action: 'Groove',
        description: 'Activer Humanize sur le MIDI pour ajouter du swing et éviter un groove trop mécanique.',
      },
      {
        action: 'Export final',
        description: 'Exporter en WAV 24 bits, normaliser à -1 dBFS, sans limitation excessive pour préserver le punch.',
      },
    ],
  },
]
