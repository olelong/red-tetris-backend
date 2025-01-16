import * as yup from 'yup';

const room = yup
  .string()
  .min(1)
  .max(10)
  .matches(/^[a-zA-Z0-9]*$/, 'room must be alphanumeric');
const username = yup
  .string()
  .min(1)
  .max(10)
  .matches(/^[a-zA-Z0-9]*$/, 'username must be alphanumeric');

export const createRoomDto = yup
  .object({ room, username })
  .test(
    'room-and-username',
    'room and username must either both be defined or both undefined',
    (value) => {
      const { room, username } = value;
      return (
        (room && username) || (room === undefined && username === undefined)
      );
    },
  );

export const joinRoomDto = yup.object({
  room: room.required(),
  username: username.required(),
});

export const moveDto = yup.object({
  move: yup
    .string()
    .oneOf(['left', 'right', 'rotation', 'soft drop', 'hard drop'])
    .required(),
});
