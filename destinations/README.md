# destinations/

One pack per country, `destinations/<cc>/` (ISO 3166-1 alpha-2, lower case):

- `config`: time zone, currency, UI and native languages with romanization
- country adapters: tax refund, entry rules
- `knowledge.md`: what matters when planning there
- `regions/<city>/`: city-level adapters (transit network, bike share, taxi fares)

The first pack, `tw`, is carved out of the legacy engine in roadmap step 3.
