import type * as PUPPET from 'wechaty-puppet'
import { ContactSelf, Message, WechatyBuilder } from 'wechaty'
import { PuppetTiktok } from '../src'
import { mock } from 'wechaty-puppet-mock'
import axios from 'axios'

const mocker = new mock.Mocker()
const puppet = new PuppetTiktok({ mocker })
const wechaty = WechatyBuilder.build({ puppet })

const start = async () => {
  const toObject = array => array.reduce((obj, cur) => (
    !!(obj[cur['id']] = cur.payload) && obj
  ), {})
  puppet.contacts = toObject(puppet.mocker.createContacts(3))
  puppet.rooms = toObject(puppet.mocker.createRooms(3))
}

const scan = (qrcode: string) => {
  console.log(`https://wechaty.js.org/qrcode/${encodeURIComponent(qrcode)}`)
}

const login = async (user: ContactSelf) => {
  console.log('User login', user.id, '\n\n')

  const allContact = await wechaty.Contact.findAll()
  console.log('allContact', allContact, '\n\n')

  const allRoom = await wechaty.Room.findAll()
  // console.log('allRoom', allRoom, '\n\n')

  // mock send message
  axios.request({
    baseURL: puppet.server,
    url: 'mockhook',
    method: 'POST',
    data: {
      event: "receive_msg",
      client_key: "awc3mc10ujmzpxsd",
      from_user_id: allContact[1].id,
      to_user_id: user.id,
      log_id: Date.now(),
      content: { message_type: "text", text: 'edg' }
    }
  })
}

const logout = (user: ContactSelf) => {
  console.log('User logout')
}

const message = (message: Message) => {
  const msg = message.text()
  const talker = message.talker()
  if (!talker) return
  if (msg != 'edg') return
  const text = 'niubi'
  talker.say(text)
  console.log(`send message "${text}" to ${talker.id}`)
}

const error = (error: PUPPET.helper.GError) => {
  console.log(error)
}

wechaty
  .on('start', start)
  .on('scan', scan)
  .on('login', login)
  .on('logout', logout)
  .on('message', message)
  .on('error', error)
  .start()