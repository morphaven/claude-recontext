---
name: check-projects
description: Claude Code projelerinin sağlık durumunu kontrol et. Kırık veya kayıp projeleri tespit et.
---

# Claude Code Proje Sağlık Kontrolü

Tüm Claude Code projelerinin sağlık durumunu kontrol et.

## Sağlık Kontrolü

Kırık projeleri tespit et (dizini artık mevcut olmayan projeler):

```bash
npx claude-recontext --check
```

Sonuçları kullanıcıya anlaşılır şekilde göster.

## Proje Listesi

Tüm kayıtlı projeleri listelemek için:

```bash
npx claude-recontext --list
```

## Kırık Proje Bulunursa

Eğer kırık projeler tespit edilirse:
1. Kırık projelerin listesini göster
2. Kullanıcıya `/recontext` komutuyla düzeltebileceklerini bildir
3. Eğer kullanıcı isterse doğrudan migrasyon işlemini başlat
