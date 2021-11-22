import type * as PUPPET from 'wechaty-puppet'
import { Puppet, PuppetOptions } from 'wechaty-puppet'
import { io } from 'socket.io-client'
import { stringify } from 'querystring'
import { Mocker } from 'wechaty-puppet-mock/dist/esm/src/mock/mocker'
import PuppetMock from 'wechaty-puppet-mock'
import axios from "axios"

export class PuppetTiktok extends Puppet {

  server = 'http://139.198.106.69:31895/'
  private socket = io(this.server)
  private redirect_uri = 'https://tiktok.321mq.com/login'
  private token: { access_token?: any; open_id?: any; } = {}
  get socketId() { return this.socket.id }
  isLoggedIn = false
  mocker: Mocker
  contacts: { [key: string]: PUPPET.payload.Contact } = {}
  rooms: { [key: string]: PUPPET.payload.Room } = {}
  messages: {
    [key: string]: { id: string, type: string, timestamp: number } & any
  } = {}

  constructor(
    public override options: PuppetOptions & { mocker?: Mocker } = {}
  ) {
    super(options)
    options?.mocker && (this.mocker = options.mocker)
    options?.mocker && (this.mocker.puppet = this as unknown as PuppetMock)
  }

  // ================================

  async onStart(): Promise<void> {
    this.initHookEvents()
  }

  async onStop(): Promise<void> {
  }

  initHookEvents() {
    this.socket.on('connect', () => this.emitScan())
    this.socket.on('authorize', res => this.emitLogin(res))
    this.socket.on('unauthorize', this.emitLogout)
    this.socket.on('receive_msg', res => this.emitMessage(res))
    this.socket.on('connect_error', (error) => {
      throw new Error(`connect_error: ${error}`)
    })
  }

  // ================================

  emitScan() {
    const server = 'https://open.douyin.com/platform/oauth/connect/'
    const client_key = 'awl0w3m654ji8l9a'
    const response_type = 'code'
    const scope = 'login_id,item.comment,user_info'
    this.emit('scan', {
      qrcode: `${server}?${stringify({
        client_key, response_type, scope,
        redirect_uri: this.redirect_uri, state: this.socketId
      })}`,
      status: 5,
    })
  }

  async emitLogin(token: any): Promise<void> {
    this.token = token
    this.contacts[token.open_id] = {
      ...token, id: token.open_id
    }
    this.isLoggedIn = true
    this.login(this.token.open_id)
  }

  async emitLogout() {
    this.token = {}
    this.isLoggedIn = false
    this.logout()
  }

  async emitMessage(msg: any) {
    this.messages[msg.log_id] = {
      id: msg.log_id, timestamp: Date.now(),
      messageId: msg.log_id,
      type: msg.content.message_type,
      text: msg.content.text,
      fromId: msg.from_user_id,
      toId: msg.to_user_id,
    }
    this.emit('message', this.messages[msg.log_id])
  }

  // ================================

  async tiktokApi({
    method, token, ...params
  }) {
    const { data: { data } } = await axios.request({
      baseURL: 'https://open.douyin.com',
      url: method,
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data' },
      params: { ...token, ...params }
    })
    return data
  }

  // ================================

  override async contactList(): Promise<string[]> {
    return Object.entries(this.contacts).map(([key, value]) => value.id)
  }

  override async contactRawPayload(
    id: string
  ): Promise<PUPPET.payload.Contact> {
    const user: PUPPET.payload.Contact = this.contacts[id]
    if (!user) throw new Error('not user')
    if (!id.includes('-')) return user
    const {
      gender, nickname, avatar
    } = await this.tiktokApi({
      method: '/oauth/userinfo/',
      token: this.token
    })
    return {
      id, gender, type: 1, name: nickname, avatar, phone: []
    }
  }

  override async contactRawPayloadParser(payload: PUPPET.payload.Contact) {
    return payload
  }

  // ================================

  override async roomList(): Promise<string[]> {
    return Object.entries(this.rooms).map(([key, value]) => value.id)
  }

  override async roomMemberList(roomId: string): Promise<string[]> {
    return []
  }

  override async roomRawPayload(id: string): Promise<PUPPET.payload.Room> {
    const room: PUPPET.payload.Room = this.rooms[id]
    if (!room) {
      throw new Error('not user')
    }
    return room
  }

  override async roomRawPayloadParser(payload: PUPPET.payload.Room) {
    return payload
  }

  // ================================

  override async messageRawPayload(id: string): Promise<PUPPET.payload.Message> {
    return this.messages[id]
  }

  override async messageRawPayloadParser(payload: PUPPET.payload.Message) {
    return payload
  }

  override async messageSendText(
    conversationId: string,
    text: string,
  ): Promise<void> {
    return this.#messageSend(conversationId, text)
  }

  async #messageSend(
    conversationId: string,
    something: string
  ): Promise<void> {
    if (!this.isLoggedIn) {
      throw new Error('not logged in')
    }

    this.tiktokApi({
      method: '/enterprise/im/message/send/',
      token: this.token,
      message_type: 'text',
      content: JSON.stringify({ text: something }),
      to_user_id: conversationId
    })
  }
}