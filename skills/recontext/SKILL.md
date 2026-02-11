---
name: recontext
description: Claude Code proje yollarını taşı. Proje dizini taşındıktan sonra konuşmaları yeni konumla eşleştir.
disable-model-invocation: true
---

# Claude Code Proje Yolu Taşıma

Kullanıcı bir Claude Code projesinin yolunu taşımak istiyor.

## Adım 1: Kırık Projeleri Tara

Öncelikle kırık projeleri tespit et:

```bash
npx claude-recontext --check
```

Sonuçları kullanıcıya göster. Kırık proje yoksa bunu bildir.

## Adım 2: Kullanıcıdan Bilgi Al

Kırık projeler varsa, kullanıcıya sor:
- Hangi projeyi taşımak istiyorlar?
- Yeni proje yolu ne?

Eğer kullanıcı doğrudan --from ve --to bilgisi verdiyse bu adımı atla.

## Adım 3: Önizleme (Dry Run)

Değişiklikleri uygulamadan önce önizle:

```bash
npx claude-recontext --from "<eski-yol>" --to "<yeni-yol>" --dry-run
```

Sonuçları kullanıcıya göster ve onay al.

## Adım 4: Migrasyonu Çalıştır

Kullanıcı onayladıktan sonra gerçek migrasyonu çalıştır:

```bash
npx claude-recontext --from "<eski-yol>" --to "<yeni-yol>"
```

## Adım 5: Doğrulama

Migrasyon tamamlandıktan sonra başarılı olup olmadığını kontrol et. Sorun varsa kullanıcıya bildir.

## Notlar

- Windows'ta path'ler case-insensitive olarak eşleştirilir
- Büyük JSONL dosyaları (300+ MB) streaming ile işlenir
- Tüm değişiklikler atomic'tir — hata durumunda otomatik geri alma yapılır
- `--dry-run` ile önizleme her zaman önerilir
