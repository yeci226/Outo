import { client } from "../index.js";
import { getLists, getListEmbed, getListComponents } from "../services/list.js";
import { EmbedBuilder, Collection } from "discord.js";

// Constants
const CONSTANTS = {
  BUTTON_PREFIX: "list",
  ERROR_COLOR: "#EE4E4E",
  COOLDOWN: 2000, // 2 seconds
  CACHE_LIFETIME: 5 * 60 * 1000 // 5 minutes
};

// Initialize database and caches
const db = client.db;
const cooldowns = new Collection();
const pageCache = new Collection();

/**
 * Button action types and their handlers
 */
const ACTIONS = {
  listBack: (currentPage, totalPages) => 
    (currentPage - 1 + totalPages.length) % totalPages.length,
  listNext: (currentPage, totalPages) => 
    (currentPage + 1) % totalPages.length,
  listRefresh: (currentPage) => currentPage
};

/**
 * Check and update cooldown for a user
 * @param {string} userId - User ID
 * @returns {boolean} - Whether the user is in cooldown
 */
function checkCooldown(userId) {
  const now = Date.now();
  const lastInteraction = cooldowns.get(userId);

  if (lastInteraction && now - lastInteraction < CONSTANTS.COOLDOWN) {
    return true;
  }

  cooldowns.set(userId, now);
  return false;
}

/**
 * Get cached page data or fetch from database
 * @param {string} guildId - Guild ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Page data
 */
async function getPageData(guildId, userId) {
  const cacheKey = `${guildId}-${userId}`;
  const now = Date.now();
  const cached = pageCache.get(cacheKey);

  if (cached && now - cached.timestamp < CONSTANTS.CACHE_LIFETIME) {
    return cached.data;
  }

  const guildData = await db.get(guildId);
  const userData = await db.get(`${userId}.list`);
  
  const data = {
    guildReplies: guildData?.replies || [],
    currentPage: userData?.currentPage || 0
  };

  pageCache.set(cacheKey, {
    timestamp: now,
    data
  });

  return data;
}

/**
 * Create error embed
 * @param {string} message - Error message
 * @returns {EmbedBuilder}
 */
function createErrorEmbed(message) {
  return new EmbedBuilder()
    .setTitle(message)
    .setColor(CONSTANTS.ERROR_COLOR);
}

// Main event handler
client.on("interactionCreate", async interaction => {
  // Basic filtering
  if (!interaction.isButton()) return;
  const { customId, guildId, user } = interaction;

  // Check if it's a list button
  if (!customId.startsWith(CONSTANTS.BUTTON_PREFIX)) return;

  try {
    // Defer update
    await interaction.deferUpdate();

    // Check cooldown
    if (checkCooldown(user.id)) return;

    // Get button action
    const action = ACTIONS[customId];
    if (!action) return;

    // Get page data
    const { guildReplies, currentPage } = await getPageData(guildId, user.id);

    // Check if guild has replies
    if (!guildReplies.length) {
      return await interaction.editReply({
        embeds: [createErrorEmbed("我沒有在這個伺服器找到任何詞彙！")],
        components: []
      });
    }

    // Get pagination data
    const { totalPages } = getLists(guildReplies);

    // Calculate new page
    const newPage = action(currentPage, totalPages);

    // Update user's current page if changed
    if (newPage !== currentPage) {
      await db.set(`${user.id}.list`, { currentPage: newPage });
    }

    // Send response
    await interaction.editReply({
      embeds: [getListEmbed(interaction, guildReplies, totalPages, newPage)],
      components: getListComponents(totalPages)
    });

  } catch (error) {
    console.error('List interaction error:', error);
    
    try {
      await interaction.editReply({
        embeds: [createErrorEmbed("處理請求時發生錯誤，請稍後再試")],
        components: []
      });
    } catch (secondaryError) {
      console.error('Error sending error message:', secondaryError);
    }
  }
});