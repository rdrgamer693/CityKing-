const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// verify.js
// Discord.js v14 slash command that shows a short "animation" (progress bar) then presents a Verify button.
// Configure ROLE_ID with the role to assign on successful verification.


// <-- Set this to the role ID you want to give verified users
const ROLE_ID = 'ROLE_ID_GOES_HERE';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Run server verification (animated progress then assign role).'),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        }

        await interaction.deferReply(); // give the bot time for the animation

        const frames = [];
        const total = 10;
        for (let i = 0; i <= total; i++) {
            const filled = '█'.repeat(i);
            const empty = '░'.repeat(total - i);
            frames.push(`Progress: [${filled}${empty}] ${Math.round((i / total) * 100)}%`);
        }

        const embed = new EmbedBuilder()
            .setTitle('Server Verification')
            .setDescription('Preparing verification...')
            .setColor(0x5865F2);

        // Send initial message
        let message = await interaction.editReply({ embeds: [embed] });

        // Run animation by editing the reply
        for (const frame of frames) {
            const animEmbed = EmbedBuilder.from(embed).setDescription(frame + '\n\nPlease wait...');
            await interaction.editReply({ embeds: [animEmbed] });
            // small delay between frames
            await new Promise((r) => setTimeout(r, 300));
        }

        // After animation, present a Verify button
        const customId = `verify_button_${Date.now()}`;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(customId)
                .setLabel('Verify')
                .setStyle(ButtonStyle.Success)
        );

        const readyEmbed = EmbedBuilder.from(embed)
            .setDescription('Animation complete. Click "Verify" to receive access to the server.')
            .setColor(0x57F287);

        message = await interaction.editReply({ embeds: [readyEmbed], components: [row] });

        // Create a collector for the button. Only allow the user who ran the command to click it.
        const filter = (i) => i.customId === customId && i.user.id === interaction.user.id;
        const collector = message.createMessageComponentCollector({ filter, time: 60_000, max: 1 });

        collector.on('collect', async (btnInteraction) => {
            await btnInteraction.deferUpdate();

            try {
                const guild = interaction.guild;
                const member = await guild.members.fetch(btnInteraction.user.id);
                const role = guild.roles.cache.get(ROLE_ID);
                if (!role) {
                    await interaction.editReply({
                        embeds: [EmbedBuilder.from(embed).setDescription('Configuration error: role not found.').setColor(0xED4245)],
                        components: [],
                    });
                    return;
                }

                await member.roles.add(role, 'Server verification');
                const successEmbed = EmbedBuilder.from(embed)
                    .setTitle('Verified')
                    .setDescription(`You have been given the role <@&${ROLE_ID}>.`)
                    .setColor(0x57F287);

                // Disable button after success
                const disabledRow = ActionRowBuilder.from(row).setComponents(
                    ButtonBuilder.from(row.components[0]).setDisabled(true).setStyle(ButtonStyle.Secondary).setLabel('Verified')
                );

                await interaction.editReply({ embeds: [successEmbed], components: [disabledRow] });
            } catch (err) {
                console.error('Verification error:', err);
                await interaction.editReply({
                    embeds: [EmbedBuilder.from(embed).setDescription('Failed to assign role. Make sure the bot has Manage Roles and the role is below the bot role.').setColor(0xED4245)],
                    components: [],
                });
            }
        });

        collector.on('end', async (collected) => {
            if (collected.size === 0) {
                // Timeout: disable the button
                const timedOutRow = ActionRowBuilder.from(row).setComponents(
                    ButtonBuilder.from(row.components[0]).setDisabled(true).setStyle(ButtonStyle.Secondary).setLabel('Timed out')
                );
                await interaction.editReply({ embeds: [EmbedBuilder.from(embed).setDescription('Verification timed out. Run /verify again.').setColor(0xED4245)], components: [timedOutRow] });
            }
        });
    },
};