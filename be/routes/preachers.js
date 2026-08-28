/**
 * Preacher routes
 * Handle preacher listing and metadata.
 *
 * Preachers are served from the normalized `profiles` table joined to
 * `video_profiles` (the M2M classification truth). A profile may span several
 * categories (e.g. full sermons + clips series); counts below use PRIMARY
 * profile assignments, mirroring the legacy `GROUP BY vid_preacher` semantics.
 *
 * SQL convention for this repo: raw queries with `?` placeholders (the db.js
 * adapter rewrites them to $n for the postgres client).
 */
const express = require("express");
const router = express.Router();
const pool = require("../db");

// Mirrors ATP-manager src/app/models.py::get_profile_key() (title stripping +
// space->underscore) so legacy /preacher/<name> URLs keep resolving after
// normalization: 'Pastor Bruce Mejia' -> 'Bruce_Mejia'.
const TITLES = ["Pastor ", "Bro ", "Deacon ", "Hno. "];
function profileKeyFromName(name) {
  if (!name || name === "-" || name === "<from the context or Unknown>") return null;
  let n = String(name).trim();
  for (const t of TITLES) {
    if (n.startsWith(t)) {
      n = n.slice(t.length);
      break;
    }
  }
  const key = n.replace(/ /g, "_");
  return key || null;
}

/**
 * GET /api/preachers
 * List all preachers with video counts
 */
router.get("/", async (_req, res) => {
  try {
    const [preachers] = await pool.query(`
      SELECT
        p.name AS name,
        p.name_slug AS slug,
        COUNT(vp.video_id) FILTER (WHERE vp.is_primary) AS videoCount,
        MAX(v.date) AS latestVideo
      FROM profiles p
      LEFT JOIN video_profiles vp ON vp.profile_id = p.id
      LEFT JOIN videos v ON v.id = vp.video_id
      GROUP BY p.id, p.name, p.name_slug
      HAVING COUNT(vp.video_id) FILTER (WHERE vp.is_primary) > 0
      ORDER BY p.name
    `);

    res.json(preachers);
  } catch (error) {
    console.error("Error fetching preachers:", error);
    res.status(500).json({ error: "Failed to fetch preachers" });
  }
});

/**
 * GET /api/preachers/:slug
 * Get preacher info and stats.
 *
 * Resolution order (keeps legacy /preacher/<raw name> URLs working):
 *   1. profiles.name_slug / profiles.name exact match
 *   2. profiles.profile_key match on the manager-derived key
 *   3. legacy fallback: videos.vid_preacher = slug (old behaviour/shape)
 */
router.get("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const [[stats]] = await pool.query(
      `
      SELECT
        p.name AS name,
        COUNT(vp.video_id) FILTER (WHERE vp.is_primary) AS videoCount,
        MAX(v.date) AS latestVideo,
        MIN(v.date) AS firstVideo,
        COALESCE(SUM(v.clicks) FILTER (WHERE vp.is_primary), 0) AS totalViews
      FROM profiles p
      LEFT JOIN video_profiles vp ON vp.profile_id = p.id
      LEFT JOIN videos v ON v.id = vp.video_id
      WHERE p.name_slug = ? OR p.name = ?
      GROUP BY p.id, p.name
    `,
      [slug, slug],
    );

    if (!stats || !Number(stats.videocount)) {
      const key = profileKeyFromName(slug);
      if (key) {
        const [[byKey]] = await pool.query(
          `
          SELECT
            p.name AS name,
            COUNT(vp.video_id) FILTER (WHERE vp.is_primary) AS videoCount,
            MAX(v.date) AS latestVideo,
            MIN(v.date) AS firstVideo,
            COALESCE(SUM(v.clicks) FILTER (WHERE vp.is_primary), 0) AS totalViews
          FROM profiles p
          LEFT JOIN video_profiles vp ON vp.profile_id = p.id
          LEFT JOIN videos v ON v.id = vp.video_id
          WHERE p.profile_key = ?
          GROUP BY p.id, p.name
          `,
          [key],
        );
        if (byKey && Number(byKey.videocount)) {
          return res.json(byKey);
        }
      }

      // legacy fallback (pre-normalization URLs / unknown names)
      const [[legacy]] = await pool.query(
        `
        SELECT
          vid_preacher as name,
          COUNT(*) as videoCount,
          MAX(date) as latestVideo,
          MIN(date) as firstVideo,
          SUM(clicks) as totalViews
        FROM videos
        WHERE vid_preacher = ?
        GROUP BY vid_preacher
        `,
        [slug],
      );
      if (legacy) {
        return res.json(legacy);
      }
      return res.status(404).json({ error: "Preacher not found" });
    }

    res.json(stats);
  } catch (error) {
    console.error("Error fetching preacher:", error);
    res.status(500).json({ error: "Failed to fetch preacher" });
  }
});

module.exports = router;
