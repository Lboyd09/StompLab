create index if not exists rig_cache_kind_hits_idx
  on rig_cache (kind, instrument, stomp_model, hit_count desc);

create index if not exists rig_cache_song_lookup_idx
  on rig_cache (kind, song);
