// شيدر معالجة الصورة بصيغة SkSL (يُجمَّع على الجهاز عبر Skia.RuntimeEffect.Make).

export const PHOTO_SKSL = `
uniform shader image;
uniform float exposure;
uniform float brightness;
uniform float contrast;
uniform float highlights;
uniform float shadows;
uniform float saturation;
uniform float vibrance;
uniform float warmth;
uniform float tint;
uniform float hue;
uniform float sharpen;
uniform float fade;
uniform float mono;
uniform float sepia;
uniform float texel;
uniform float3 shadowTint;
uniform float3 highlightTint;

float luma(float3 c) {
  return dot(c, float3(0.2126, 0.7152, 0.0722));
}

half4 main(float2 xy) {
  half4 src = image.eval(xy);
  float a = float(src.a);
  float3 c = float3(src.rgb);
  if (a > 0.0001) {
    c = c / a;
  }

  if (sharpen > 0.0) {
    float3 n = float3(image.eval(xy + float2(texel, 0.0)).rgb);
    n += float3(image.eval(xy - float2(texel, 0.0)).rgb);
    n += float3(image.eval(xy + float2(0.0, texel)).rgb);
    n += float3(image.eval(xy - float2(0.0, texel)).rgb);
    c += (c * 4.0 - n) * (sharpen * 0.25);
  }

  c = max(c, float3(0.0));
  c = sqrt(max(c * c * exp2(exposure), float3(0.0)));

  c.r += warmth * 0.10;
  c.b -= warmth * 0.10;
  c.g -= tint * 0.06;
  c.r += tint * 0.03;
  c.b += tint * 0.03;

  c += float3(brightness);
  c = (c - 0.5) * contrast + 0.5;

  float l = luma(c);
  c += float3(shadows * 0.25 * (1.0 - smoothstep(0.0, 0.5, l)));
  c += float3(highlights * 0.25 * smoothstep(0.5, 1.0, l));

  float l2 = luma(c);
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float s = saturation * (1.0 + vibrance * (1.0 - clamp(mx - mn, 0.0, 1.0)));
  c = mix(float3(l2), c, max(s, 0.0));

  if (hue != 0.0) {
    float y = dot(c, float3(0.299, 0.587, 0.114));
    float i = dot(c, float3(0.596, -0.274, -0.322));
    float q = dot(c, float3(0.211, -0.523, 0.312));
    float cs = cos(hue);
    float sn = sin(hue);
    float i2 = i * cs - q * sn;
    float q2 = i * sn + q * cs;
    c = float3(y + 0.956 * i2 + 0.621 * q2, y - 0.272 * i2 - 0.647 * q2, y - 1.106 * i2 + 1.703 * q2);
  }

  float l3 = luma(c);
  c = mix(c, float3(l3), mono);
  float3 sp = float3(
    dot(c, float3(0.393, 0.769, 0.189)),
    dot(c, float3(0.349, 0.686, 0.168)),
    dot(c, float3(0.272, 0.534, 0.131))
  );
  c = mix(c, sp, sepia);

  float l4 = luma(c);
  c += shadowTint * (1.0 - smoothstep(0.0, 0.6, l4));
  c += highlightTint * smoothstep(0.4, 1.0, l4);
  c = c * (1.0 - fade * 0.25) + float3(fade * 0.12);
  c = clamp(c, 0.0, 1.0);

  return half4(half3(c * a), half(a));
}
`;

export const GRAIN_SKSL = `
uniform float amount;
uniform float cell;

float hash(float2 p) {
  return fract(sin(dot(p, float2(12.9898, 78.233))) * 43758.5453);
}

half4 main(float2 xy) {
  float n = hash(floor(xy / cell));
  half a = half(amount);
  return half4(half3(half(n)) * a, a);
}
`;
