# Alfred

Site vitrine du spectacle musical **ALFRED**, avec un espace membre compatible Netlify.

## Espace membre Netlify

L’espace membre utilise des **Netlify Functions** pour éviter de mettre le mot de passe dans le code public du site.

### Identifiants autorisés et rôles

Les membres autorisés sont déclarés dans :

```text
netlify/data/members.json
```

Rôles :

- `admin` : peut consulter le planning et ajouter des dates.
- `member` : peut consulter le planning uniquement.

Admins par défaut :

- `Niwa`
- `Noah`

Membres par défaut :

- `Marie`
- `TomEliott`
- `Stecy`
- `Luce`
- `Ayline`
- `Ambre`
- `Ezio`
- `Thomas`
- `Majda`

Tous les comptes utilisent le mot de passe par défaut :

```text
Alfred2026
```

### Planning

Les dates de base du planning sont déclarées dans :

```text
netlify/data/planning.json
```

Les dates ajoutées depuis l’interface admin sont stockées dans **Netlify Blobs** via la fonction :

```text
/.netlify/functions/add-planning
```

### Variables d’environnement Netlify

Le site fonctionne directement avec le mot de passe par défaut :

```text
Alfred2026
```

Pour personnaliser ou renforcer la configuration, tu peux ajouter ces variables dans **Site configuration > Environment variables** :

```text
MEMBER_PASSWORD=Alfred2026
SESSION_SECRET=une-phrase-longue-et-secrete
```

`SESSION_SECRET` doit rester privé. Il sert à signer la session de connexion. Si tu ne le définis pas, la session utilise le mot de passe membre comme secret de secours.

## Déploiement

Le fichier `netlify.toml` indique à Netlify où trouver les fonctions serverless :

```text
netlify/functions
```

Une fois le site redéployé, Noah et Niwa pourront ajouter des dates depuis l’espace Planning. Les autres membres pourront les consulter.
