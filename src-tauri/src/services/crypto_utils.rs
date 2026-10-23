use ring::hmac;

pub fn hmac_sha512_hex(key: &[u8], data: &[u8]) -> String {
    let s_key = hmac::Key::new(hmac::HMAC_SHA512, key);
    let tag = hmac::sign(&s_key, data);
    let mut out = String::with_capacity(128);
    for b in tag.as_ref() {
        use std::fmt::Write;
        let _ = write!(out, "{:02x}", b);
    }
    out
}

pub fn md5_hex(input: &[u8]) -> String {
    let digest = md5_digest(input);
    let mut out = String::with_capacity(32);
    for b in digest {
        use std::fmt::Write;
        let _ = write!(out, "{:02x}", b);
    }
    out
}

fn md5_digest(initial_msg: &[u8]) -> [u8; 16] {
    let mut msg = initial_msg.to_vec();
    let bit_len = (initial_msg.len() as u64) * 8;

    msg.push(0x80);
    while (msg.len() % 64) != 56 {
        msg.push(0);
    }
    msg.extend_from_slice(&bit_len.to_le_bytes());

    let mut a: u32 = 0x67452301;
    let mut b: u32 = 0xefcdab89;
    let mut c: u32 = 0x98badcfe;
    let mut d: u32 = 0x10325476;

    let s = [
        7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
        5,  9, 14, 20, 5,  9, 14, 20, 5,  9, 14, 20, 5,  9, 14, 20,
        4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
        6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
    ];

    let k = [
        0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee,
        0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
        0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
        0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
        0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa,
        0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
        0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
        0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
        0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
        0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
        0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05,
        0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
        0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039,
        0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
        0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
        0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
    ];

    for chunk in msg.chunks_exact(64) {
        let mut w = [0u32; 16];
        for (i, word) in chunk.chunks_exact(4).enumerate() {
            w[i] = u32::from_le_bytes(word.try_into().unwrap());
        }

        let mut aa = a;
        let mut bb = b;
        let mut cc = c;
        let mut dd = d;

        for i in 0..64 {
            let (f, g) = match i {
                0..=15 => ((bb & cc) | ((!bb) & dd), i),
                16..=31 => ((dd & bb) | ((!dd) & cc), (5 * i + 1) % 16),
                32..=47 => (bb ^ cc ^ dd, (3 * i + 5) % 16),
                48..=63 => (cc ^ (bb | (!dd)), (7 * i) % 16),
                _ => unreachable!(),
            };

            let temp = dd;
            dd = cc;
            cc = bb;
            bb = bb.wrapping_add(
                (aa.wrapping_add(f).wrapping_add(k[i]).wrapping_add(w[g])).rotate_left(s[i]),
            );
            aa = temp;
        }

        a = a.wrapping_add(aa);
        b = b.wrapping_add(bb);
        c = c.wrapping_add(cc);
        d = d.wrapping_add(dd);
    }

    let mut result = [0u8; 16];
    result[0..4].copy_from_slice(&a.to_le_bytes());
    result[4..8].copy_from_slice(&b.to_le_bytes());
    result[8..12].copy_from_slice(&c.to_le_bytes());
    result[12..16].copy_from_slice(&d.to_le_bytes());
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_md5_empty() {
        assert_eq!(md5_hex(b""), "d41d8cd98f00b204e9800998ecf8427e");
    }

    #[test]
    fn test_md5_hello() {
        assert_eq!(md5_hex(b"hello world"), "5eb63bbbe01eeed093cb22bb8f5acdc3");
    }

    #[test]
    fn test_holyrics_song_hash() {
        let key = "4da58f6b-94f0-41a2-b3e4-c90d2fe24a0b;S4";
        let step1 = md5_hex(key.as_bytes());
        let step2 = hmac_sha512_hex(b"zjz8FXCFa8gE4jXebl7ETqd6IOrRoQZr", step1.as_bytes());
        let final_hash = md5_hex(step2.as_bytes());
        assert_eq!(final_hash, "5c0ee121ca8bce671d5e6de4cb26546a");
    }
}
