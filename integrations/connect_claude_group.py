"""Join only the owner-approved Arklin Team group and verify membership."""
import asyncio
import json
from pathlib import Path
from telethon import TelegramClient, functions, types
from bridge import copy_session, GROUP_ID, USER_ID

async def main():
    auth=json.loads(Path('/root/.telegram_sessions/auth_state.json').read_text())
    path=Path('/var/lib/arklyn-office/provision.session')
    copy_session('/root/.telegram_sessions/telethon_user.session',path)
    client=TelegramClient(str(path),int(auth['api_id']),auth['api_hash'],receive_updates=False)
    async with client:
        me=await client.get_me()
        assert me.id==USER_ID
        group=await client.get_entity(GROUP_ID)
        bot=await client.get_entity('ClaudeCode_pro_bot')
        try:
            member=(await client(functions.channels.GetParticipantRequest(group,bot))).participant
            present=not isinstance(member,(types.ChannelParticipantLeft,types.ChannelParticipantBanned))
        except Exception:
            present=False
        if not present:
            await client(functions.channels.InviteToChannelRequest(group,[bot]))
        member=(await client(functions.channels.GetParticipantRequest(group,bot))).participant
        assert not isinstance(member,(types.ChannelParticipantLeft,types.ChannelParticipantBanned))
        if not isinstance(member, types.ChannelParticipantAdmin):
            # Privacy-enabled bots need administrator status for ordinary addressed text.
            # Grant only the basic administrator marker, no deletion/invite/pin/promotion powers.
            await client(functions.channels.EditAdminRequest(group, bot, types.ChatAdminRights(other=True), 'Arklyn Office'))
            member=(await client(functions.channels.GetParticipantRequest(group,bot))).participant
        assert isinstance(member, types.ChannelParticipantAdmin)
        rights=member.admin_rights
        assert not any(getattr(rights, name, False) for name in ['delete_messages','add_admins','invite_users','ban_users','pin_messages','change_info','manage_topics'])
        print('PASS verified @ClaudeCode_pro_bot membership and minimal receive-only administrator rights in Arklin Team')
    for suffix in ['', '-journal','-wal','-shm']:
        Path(str(path)+suffix).unlink(missing_ok=True)

if __name__=='__main__': asyncio.run(main())
