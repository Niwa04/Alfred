# Alfred

Site vitrine du spectacle musical **ALFRED**, avec un espace membre compatible Netlify.

## Espace membre Netlify

L’espace membre utilise des **Netlify Functions** pour éviter de mettre le mot de passe dans le code public du site.

### Identifiants autorisés

Les membres autorisés sont déclarés dans :

```text
netlify/data/members.json
```

Par défaut :

- `Niwa`
- `Noah`

### Planning

Le planning affiché dans l’espace membre est déclaré dans :

```text
netlify/data/planning.json
```

### Variables d’environnement à ajouter dans Netlify

Dans Netlify, ajouter ces variables dans **Site configuration > Environment variables** :

```text
MEMBER_PASSWORD=Alfred2026
SESSION_SECRET=une-phrase-longue-et-secrete
```

`SESSION_SECRET` doit rester privé. Il sert à signer la session de connexion.

## Déploiement

Le fichier `netlify.toml` indique à Netlify où trouver les fonctions serverless :

```text
netlify/functions
```

Une fois les variables d’environnement configurées, Netlify peut redéployer le site automatiquement depuis GitHub.
