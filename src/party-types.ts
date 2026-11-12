export type Action = 'dance'|'idle'|'lie'|'wave'
export type Avatar = { seed:number;outfit:'dress'|'suit';color:string;accent:string;skin:string;hair:string;hairStyle:number;accessory:number;pattern:number }
export type Player = { id:string;nickname:string;avatar:Avatar;x:number;z:number;yaw:number;action:Action;actionAt:number;moving:boolean }
export type PlayerState = Omit<Player,'nickname'|'avatar'>
