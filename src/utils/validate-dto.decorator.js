export default function ValidateDto(dto) {
  return function (_, __, descriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (client, data, ...args) {
      let validatedData;
      try {
        validatedData = await dto.validate(data, { abortEarly: false });
      } catch (error) {
        const event = Reflect.getMetadata('message', descriptor.value);
        client.emit('error', {
          errorMsg: error.errors,
          origin: { event, data },
        });
      }
      if (validatedData)
        return await originalMethod.call(this, client, validatedData, ...args);
    };
    return descriptor;
  };
}
