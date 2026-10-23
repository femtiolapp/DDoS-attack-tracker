# Country coordinates

Snapshot downloaded 2026-10-23 from the maintained mledoze/countries dataset:
https://github.com/mledoze/countries
https://raw.githubusercontent.com/mledoze/countries/master/countries.json

The unmodified countries.json snapshot is distributed under ODbL 1.0; see
LICENSE.countries. Refresh deliberately by replacing the file from upstream,
reviewing the diff and running the backend tests. `cca2`, `name.common`, and
`latlng` are used. Points are approximate country representatives, not cities or
attack locations. Unrecognized codes retain null coordinates.
