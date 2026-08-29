/**
 * Categories routes
 * Handles category listing, autocomplete, and category video listing.
 *
 * Categories are served from the normalized `categories` table joined to
 * `video_categories` (the M2M classification truth). `videoCount` counts
 * PRIMARY category assignments; `videoCountAux` counts videos where the
 * category is an auxiliary assignment (voice-detected secondary category).
 *
 * SQL convention for this repo: raw queries with `?` placeholders (the db.js
 * adapter rewrites them to $n for the postgres client).
 */
const express = require("express");
const router = express.Router();
const db = require("../db");

const parseLimit = (value, fallback = 20, max = 200) => {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
        return fallback;
    }
    return Math.min(parsed, max);
};

const parsePage = (value, fallback = 1) => {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
        return fallback;
    }
    return parsed;
};

/**
 * GET /api/categories
 * Get all categories with video counts
 * Query params: q (search query for autocomplete)
 */
router.get("/", async (req, res) => {
    try {
        const { q } = req.query;

        const baseQuery = `
            SELECT
                c.slug AS slug,
                c.name AS name,
                COUNT(vc.video_id) FILTER (WHERE vc.is_primary) AS "videoCount",
                COUNT(vc.video_id) FILTER (WHERE NOT vc.is_primary) AS "videoCountAux"
            FROM categories c
            LEFT JOIN video_categories vc ON vc.category_id = c.id
            WHERE c.active
            GROUP BY c.id, c.slug, c.name
        `;

        const filters = [];
        const params = [];
        if (q) {
            filters.push("name ILIKE ?");
            params.push(`%${q}%`);
        }
        // Aliases are quoted (case-preserved) above, so outer references must quote too.
        filters.push('("videoCount" + "videoCountAux") > 0');

        const where = filters.length ? ` WHERE ${filters.join(" AND ")}` : "";
        const query = `SELECT * FROM (${baseQuery}) AS categories${where}
                       ORDER BY "videoCount" DESC, name ASC`;

        const [categories] = await db.query(query, params);
        res.json(categories);
    } catch (error) {
        console.error("Error fetching categories:", error);
        res.status(500).json({ error: "Failed to fetch categories" });
    }
});

/**
 * GET /api/categories/:name
 * Get category details and videos
 * Query params: page, limit, include_aux (1|true) — when set, also include
 * videos where this category is an auxiliary (voice-detected) assignment.
 */
router.get("/:name", async (req, res) => {
    try {
        const { name } = req.params;
        const includeAux =
            req.query.include_aux === "1" || req.query.include_aux === "true";
        const page = parsePage(req.query.page, 1);
        const limit = parseLimit(req.query.limit, 20, 200);
        const offset = (page - 1) * limit;

        const [catRows] = await db.query(
            "SELECT c.id, c.slug, c.name FROM categories c WHERE c.slug = ? OR c.name = ?",
            [name, name],
        );
        if (!catRows.length) {
            return res.status(404).json({ error: "Category not found" });
        }
        const categoryId = catRows[0].id;

        const roleClause = includeAux ? "" : "AND vc.is_primary";

        const [videos] = await db.query(
            `SELECT v.*
             FROM videos v
             JOIN video_categories vc ON vc.video_id = v.id
             WHERE vc.category_id = ? ${roleClause}
             ORDER BY v.date DESC
             LIMIT ? OFFSET ?`,
            [categoryId, limit, offset],
        );

        const [[{ total }]] = await db.query(
            `SELECT COUNT(DISTINCT v.id) AS total
             FROM videos v
             JOIN video_categories vc ON vc.video_id = v.id
             WHERE vc.category_id = ? ${roleClause}`,
            [categoryId],
        );

        res.json({
            category: catRows[0].slug,
            videos,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Error fetching category:", error);
        res.status(500).json({ error: "Failed to fetch category" });
    }
});

module.exports = router;
